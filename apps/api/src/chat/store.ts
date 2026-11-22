import { PlaceStore } from '../places/store.js';
import { createHash, randomUUID } from 'node:crypto';
import { emptySummary, savedSummarySchema, supportingSummary, chatThreadSchema, chatMessageSchema, chatPageSchema, chatRequestResultSchema } from '@fuzl/planning';
import type { ChatActor, ChatCreate, ChatJoin, ChatSend, ChatThread, ChatRequest, ChatPlan, PlanAnswer, ChatApply, ChatRequestInput } from '@fuzl/planning';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { ExtractionError } from '../extraction/errors.js';
import { mergeNativeSummary, removeNativeSources } from './summary.js';
export const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const denied=()=>new ExtractionError(403,'chat_access_revoked','Conversation access is unavailable, expired or revoked. Your unsent text was kept. Ask the organizer for access.');
const stale=()=>new ExtractionError(409,'chat_stale','The conversation or plan changed. Refresh and review the current version; nothing was replaced.');
const include={group:{include:{owner:true}},members:{include:{invite:true},orderBy:{createdAt:'asc' as const}}};
export type ThreadRow=Prisma.ChatThreadGetPayload<{include:typeof include}>;
type MemberRow=ThreadRow['members'][number];
export type MessageRow=Prisma.ChatMessageGetPayload<object>;
type RequestRow=Prisma.ChatRequestGetPayload<object>;
export interface ChatSnapshot {thread:ThreadRow;me:MemberRow;sessionRevision:number;messages:MessageRow[];job:RequestRow;existing:boolean}
export class ChatStore {
  constructor(readonly db:PrismaClient,readonly now:()=>number=Date.now){}
  active(member:MemberRow){return !member.removedAt&&(member.role==='organizer'||!!member.invite&&!member.invite.revokedAt&&member.invite.expiresAt.getTime()>this.now());}
  async locked<T>(id:string,actor:ChatActor,work:(tx:Prisma.TransactionClient,thread:ThreadRow,me:MemberRow)=>Promise<T>){
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM fuzl.fuzl_chat_threads WHERE id=${id}::uuid FOR UPDATE`;
      const thread=await tx.chatThread.findUnique({where:{id},include});if(!thread)throw denied();
      const me=thread.members.find(m=>actor.subject?m.authSubject===actor.subject:!!m.credentialDigest&&m.credentialDigest===digest(actor.credential!));
      if(!me||!this.active(me)||me.role==='organizer'&&me.authSubject!==thread.group.owner.authSubject)throw denied();
      return work(tx,thread,me);
    });
  }
  owner(thread:ThreadRow,me:MemberRow){if(me.role!=='organizer'||me.authSubject!==thread.group.owner.authSubject)throw new ExtractionError(403,'chat_organizer_required','Only this group’s organizer can do that.');}
  async list(subject:string){
    const threads=await this.db.chatThread.findMany({where:{OR:[{group:{owner:{authSubject:subject}}},{members:{some:{authSubject:subject,removedAt:null}}}]},include,orderBy:{createdAt:'desc'},take:100});
    return threads.filter(t=>t.members.some(m=>m.authSubject===subject&&this.active(m))).map(t=>({id:t.id,title:t.title,groupId:t.groupId,groupName:t.group.name,sessionId:t.sessionId}));
  }
  async create(subject:string,input:ChatCreate){
    return this.db.$transaction(async tx=>{
      const group=await tx.group.findFirst({where:{id:input.groupId,owner:{authSubject:subject}}});if(!group)throw denied();
      await tx.$queryRaw`SELECT id FROM fuzl.fuzl_groups WHERE id=${group.id}::uuid FOR UPDATE`;
      const hash=digest(JSON.stringify(input)),previous=await tx.chatThread.findUnique({where:{groupId_creationId:{groupId:group.id,creationId:input.creationId}}});
      if(previous){if(previous.creationHash!==hash)throw stale();return previous.id;}
      let sessionId=input.sessionId;
      if(sessionId){await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id=${sessionId}::uuid FOR UPDATE`;const session=await tx.planningSession.findFirst({where:{id:sessionId,groupId:group.id}});if(!session)throw denied();if(await tx.chatThread.findUnique({where:{sessionId}}))throw new ExtractionError(409,'chat_session_thread','This session already has an outing conversation. Open that thread.');}
      else sessionId=(await tx.planningSession.create({data:{groupId:group.id,title:input.title,summary:json(emptySummary()),provenance:[],origin:'manual'}})).id;
      const thread=await tx.chatThread.create({data:{groupId:group.id,sessionId,title:input.title,creationId:input.creationId,creationHash:hash,sharedSummary:json(emptySummary()),members:{create:{authSubject:subject,joinId:randomUUID(),displayName:input.displayName,role:'organizer',canAI:true}}}});
      return thread.id;
    });
  }
  async thread(actor:ChatActor,id:string):Promise<ChatThread>{return this.locked(id,actor,async(tx,t,me)=>{
    const requests=await tx.chatRequest.findMany({where:{threadId:id},orderBy:{createdAt:'desc'},take:12});
    return chatThreadSchema.parse({id:t.id,groupId:t.groupId,groupName:t.group.name,sessionId:t.sessionId,title:t.title,version:t.version,contentVersion:t.contentVersion,sharedVersion:t.sharedVersion,sharedSummary:t.sharedSummary,me:this.memberDTO(me),members:t.members.map(m=>({...this.memberDTO(m),planningParticipantId:me.role==='organizer'?m.planningParticipantId:null})),requests:requests.map(r=>this.requestDTO(r,t))});
  });}
  memberDTO(m:MemberRow){return {id:m.id,name:m.displayName,role:m.role,identity:m.authSubject?'account':'guest',canAI:m.canAI,active:this.active(m),planningParticipantId:m.planningParticipantId};}
  messageDTO(m:MessageRow){return chatMessageSchema.parse({id:m.id,submissionId:m.submissionId,memberId:m.memberId,author:m.author,kind:m.kind,sequence:m.sequence,changeVersion:m.changeVersion,text:m.deletedAt?null:m.body,createdAt:m.createdAt.toISOString(),deleted:!!m.deletedAt,requestId:m.requestId});}
  requestDTO(r:RequestRow,t:ThreadRow):ChatRequest{
    const result=r.result as {plan?:ChatPlan;answer?:PlanAnswer}|null;
    const expired=r.state==='pending'&&this.now()-r.createdAt.getTime()>60000;
    const changed=r.contentVersion!==t.contentVersion||r.sharedVersion!==t.sharedVersion;
    return chatRequestResultSchema.parse({id:r.id,memberId:r.memberId,kind:r.kind,state:expired?'failed':r.state==='ready'&&changed?'stale':r.state,contentVersion:r.contentVersion,sharedVersion:r.sharedVersion,plan:result?.plan??null,answer:result?.answer??null,sourceMessages:r.sourceMap,message:expired?'The request lease ended. Check its receipt or request a new plan deliberately; nothing was applied.':r.state==='ready'&&changed?'New discussion or planning changes since this response. Review a new proposal before applying.':r.message,createdAt:r.createdAt.toISOString()});
  }
  async page(actor:ChatActor,id:string,input:{before?:number;changesAfter?:number}={}){return this.locked(id,actor,async(tx,t)=>{
    const changes=input.changesAfter!==undefined;
    const rows=await tx.chatMessage.findMany({where:{threadId:id,...(changes?{changeVersion:{gt:input.changesAfter,lte:t.version}}:input.before?{sequence:{lt:input.before}}:{})},orderBy:changes?{changeVersion:'asc'}:{sequence:'desc'},take:changes?101:51});
    const reset=changes&&rows.length>100;
    const messages=reset?[]:changes?rows:rows.slice(0,50).reverse();
    return chatPageSchema.parse({messages:messages.map(m=>this.messageDTO(m)),version:t.version,hasOlder:!changes&&rows.length>50,reset});
  });}
  async message(actor:ChatActor,id:string,messageId:string){return this.locked(id,actor,async(tx)=>{const row=await tx.chatMessage.findFirst({where:{threadId:id,id:messageId}});if(!row)throw denied();return this.messageDTO(row);});}
  async version(actor:ChatActor,id:string){return this.locked(id,actor,async(_tx,t)=>t.version);}
  async rename(actor:ChatActor,id:string,title:string,version:number){return this.locked(id,actor,async(tx,t,me)=>{this.owner(t,me);if(t.version!==version)throw stale();await tx.chatThread.update({where:{id},data:{title,version:{increment:1}}});});}
  async invitations(actor:ChatActor,id:string){return this.locked(id,actor,async(tx,t,me)=>{this.owner(t,me);const rows=await tx.chatInvite.findMany({where:{threadId:id,revokedAt:null,expiresAt:{gt:new Date(this.now())}},orderBy:{createdAt:'desc'},take:20});return rows.map(row=>({id:row.id,expiresAt:row.expiresAt.toISOString(),allowAI:row.allowAI,revoked:!!row.revokedAt,active:!row.revokedAt&&row.expiresAt.getTime()>this.now()}));});}
  async invite(actor:ChatActor,id:string,input:{id:string;token:string;days:number;allowAI:boolean}){return this.locked(id,actor,async(tx,t,me)=>{
    this.owner(t,me);const hash=digest(input.token),old=await tx.chatInvite.findUnique({where:{id:input.id}});
    if(old){if(old.threadId!==id||old.tokenDigest!==hash||old.allowAI!==input.allowAI)throw stale();return {id:old.id,expiresAt:old.expiresAt.toISOString(),allowAI:old.allowAI};}
    if(await tx.chatInvite.count({where:{threadId:id,revokedAt:null,expiresAt:{gt:new Date(this.now())}}})>=20)throw new ExtractionError(429,'chat_invitation_limit','This outing has 20 active invitations. Revoke an earlier one before creating another.');
    const row=await tx.chatInvite.create({data:{id:input.id,threadId:id,tokenDigest:hash,allowAI:input.allowAI,expiresAt:new Date(this.now()+input.days*86400000)}});return{id:row.id,expiresAt:row.expiresAt.toISOString(),allowAI:row.allowAI};
  });}
  async invitePreview(token:string){const invite=await this.db.chatInvite.findUnique({where:{tokenDigest:digest(token)},include:{thread:{include:{group:true}}}});if(!invite||invite.revokedAt||invite.expiresAt.getTime()<=this.now())throw denied();return {id:invite.id,threadId:invite.threadId,title:invite.thread.title,groupName:invite.thread.group.name,allowAI:invite.allowAI,expiresAt:invite.expiresAt.toISOString(),history:'All native messages and group-visible plan responses in this outing, including earlier history. Private sessions, imports and budgets shared privately are excluded.'};}
  async join(token:string,subject:string|null,input:ChatJoin){
    const preview=await this.invitePreview(token);
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM fuzl.fuzl_chat_threads WHERE id=${preview.threadId}::uuid FOR UPDATE`;
      const invite=await tx.chatInvite.findUnique({where:{id:preview.id}});if(!invite||invite.revokedAt||invite.expiresAt.getTime()<=this.now())throw denied();
      const old=subject?await tx.chatMember.findUnique({where:{threadId_authSubject:{threadId:preview.threadId,authSubject:subject}},include:{invite:true}}):await tx.chatMember.findUnique({where:{threadId_joinId:{threadId:preview.threadId,joinId:input.joinId}},include:{invite:true}});
      if(old){if(!subject&&old.credentialDigest!==digest(input.credential)||!this.active(old))throw denied();return {threadId:preview.threadId,memberId:old.id};}
      if(await tx.chatMember.count({where:{threadId:preview.threadId}})>=20)throw new ExtractionError(409,'chat_roster_limit','This thread has reached its 20-identity limit. Ask the organizer to start another outing.');
      const member=await tx.chatMember.create({data:{threadId:preview.threadId,inviteId:invite.id,joinId:input.joinId,authSubject:subject,credentialDigest:subject?null:digest(input.credential),displayName:input.displayName,role:'member',canAI:invite.allowAI}});
      await tx.chatThread.update({where:{id:preview.threadId},data:{version:{increment:1},contentVersion:{increment:1}}});return {threadId:preview.threadId,memberId:member.id};
    });
  }
  async remove(actor:ChatActor,id:string,memberId:string){return this.locked(id,actor,async(tx,t,me)=>{if(me.id!==memberId)this.owner(t,me);const member=t.members.find(m=>m.id===memberId);if(!member||member.role==='organizer')throw new ExtractionError(400,'chat_owner_stays','The organizer cannot leave their owned thread. Delete its saved session instead.');await tx.chatMember.update({where:{id:memberId},data:{removedAt:new Date(this.now())}});await tx.chatThread.update({where:{id},data:{version:{increment:1},contentVersion:{increment:1}}});});}
  async revoke(actor:ChatActor,id:string,inviteId:string){return this.locked(id,actor,async(tx,t,me)=>{this.owner(t,me);const result=await tx.chatInvite.updateMany({where:{id:inviteId,threadId:id},data:{revokedAt:new Date(this.now())}});if(!result.count)throw denied();await tx.chatThread.update({where:{id},data:{version:{increment:1},contentVersion:{increment:1}}});});}
  async mapMember(actor:ChatActor,id:string,memberId:string,planningParticipantId:string|null,contentVersion:number){return this.locked(id,actor,async(tx,t,me)=>{
    this.owner(t,me);if(t.contentVersion!==contentVersion)throw stale();if(!t.members.some(m=>m.id===memberId))throw denied();
    const summary=savedSummarySchema.parse((await tx.planningSession.findUniqueOrThrow({where:{id:t.sessionId}})).summary);
    if(planningParticipantId&&!summary.participants.some(p=>p.id===planningParticipantId)||planningParticipantId&&t.members.some(m=>m.id!==memberId&&m.planningParticipantId===planningParticipantId))throw new ExtractionError(400,'chat_mapping','Choose an existing, uniquely mapped planning participant. Names alone never establish identity.');
    await tx.chatMember.update({where:{id:memberId},data:{planningParticipantId}});await tx.chatThread.update({where:{id},data:{version:{increment:1},contentVersion:{increment:1}}});
  });}
  async send(actor:ChatActor,id:string,input:ChatSend){return this.locked(id,actor,async(tx,t,me)=>{
    const hash=digest(input.text),old=await tx.chatMessage.findUnique({where:{threadId_memberId_submissionId:{threadId:id,memberId:me.id,submissionId:input.submissionId}}});
    if(old){if(old.submissionHash!==hash)throw new ExtractionError(409,'chat_retry_changed','That submission ID already belongs to different text. The original message was kept.');return this.messageDTO(old);}
    const version=t.version+1,row=await tx.chatMessage.create({data:{threadId:id,memberId:me.id,author:me.displayName,submissionId:input.submissionId,submissionHash:hash,sequence:t.nextSequence+1,changeVersion:version,kind:'person',body:input.text}});
    await tx.chatThread.update({where:{id},data:{version,contentVersion:{increment:1},nextSequence:{increment:1}}});return this.messageDTO(row);
  });}
  async deleteMessage(actor:ChatActor,id:string,messageId:string){return this.locked(id,actor,async(tx,t,me)=>{
    const message=await tx.chatMessage.findFirst({where:{id:messageId,threadId:id}});if(!message)throw denied();if(message.memberId!==me.id)this.owner(t,me);if(message.deletedAt)return;
    if(message.kind!=='person'){await tx.chatMessage.update({where:{id:messageId},data:{body:null,deletedAt:new Date(this.now()),changeVersion:t.version+1}});await tx.chatThread.update({where:{id},data:{version:{increment:1}}});return;}
    await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id=${t.sessionId}::uuid FOR UPDATE`;
    const sourceMap=t.sharedSources as Record<string,string>,removed=Object.keys(sourceMap).filter(key=>sourceMap[key]===messageId);
    const shared=removeNativeSources(savedSummarySchema.parse(t.sharedSummary),removed),session=await tx.planningSession.findUniqueOrThrow({where:{id:t.sessionId}});
    const summary=removeNativeSources(savedSummarySchema.parse(session.summary),removed),version=t.version+1;
    await tx.chatMessage.update({where:{id:messageId},data:{body:null,deletedAt:new Date(this.now()),changeVersion:version}});
    await tx.chatRequest.updateMany({where:{threadId:id},data:{state:'stale',result:undefined,message:'Source discussion changed or was removed. Generate and review a new proposal.'}});
    // DB JSON null explicitly removes previously derived quotes too.
    await tx.$executeRaw`UPDATE fuzl.fuzl_chat_requests SET result=NULL WHERE "threadId"=${id}::uuid`;
    await tx.chatMessage.updateMany({where:{threadId:id,kind:'fuzl'},data:{body:'Fuzl response withdrawn after a source message was removed. Review the current plan.',changeVersion:version}});
    await tx.planningSession.update({where:{id:t.sessionId},data:{summary:json(supportingSummary(summary)),provenance:json((session.provenance as {sourceId:string}[]).filter(p=>!removed.includes(p.sourceId))),revision:{increment:1}}});
    await tx.chatThread.update({where:{id},data:{sharedSummary:json(shared),sharedSources:json(Object.fromEntries(Object.entries(sourceMap).filter(([key])=>!removed.includes(key)))),sharedVersion:{increment:1},contentVersion:{increment:1},version}});
  });}
  async prepareReview(actor:ChatActor,id:string,input:{contentVersion:number;sharedVersion:number}){return this.locked(id,actor,async(tx,t,me)=>{
    this.owner(t,me);if(t.contentVersion!==input.contentVersion||t.sharedVersion!==input.sharedVersion)throw stale();
    const summary=savedSummarySchema.parse(t.sharedSummary);if(!summary.facts.length)throw new ExtractionError(422,'chat_shared_empty','Apply a shared proposal first, or use the full workspace for a manual plan.');
    const session=await tx.planningSession.findUniqueOrThrow({where:{id:t.sessionId}}),job=await tx.chatRequest.create({data:{id:randomUUID(),threadId:id,memberId:me.id,inputHash:digest(JSON.stringify(input)),kind:'plan',state:'ready',contentVersion:t.contentVersion,sharedVersion:t.sharedVersion,sessionRevision:session.revision,sourceVersions:[],sourceMap:json(t.sharedSources),result:json({plan:{summary,suggestions:[],followUp:'Review the shared facts and apply corrections explicitly. No AI request ran.',usedMessages:0}}),message:'Organizer correction preview · no AI request.'}});
    await tx.chatThread.update({where:{id},data:{version:{increment:1}}});return this.requestDTO(job,t);
  });}
  async begin(actor:ChatActor,id:string,input:ChatRequestInput):Promise<ChatSnapshot>{return this.locked(id,actor,async(tx,t,me)=>{
    if(input.kind==='plan'&&!me.canAI)throw new ExtractionError(403,'chat_ai_permission','Ask the organizer to make a plan or explicitly grant AI access. Recorded-fact questions remain available.');
    const hash=digest(JSON.stringify(input)),old=await tx.chatRequest.findUnique({where:{id:input.requestId}});
    const session=await tx.planningSession.findUniqueOrThrow({where:{id:t.sessionId}});
    if(old){if(old.threadId!==id||old.memberId!==me.id||old.inputHash!==hash)throw stale();return{thread:t,me,sessionRevision:session.revision,messages:[],job:old,existing:true};}
    if(t.contentVersion!==input.contentVersion||t.sharedVersion!==input.sharedVersion)throw stale();
    if(input.kind==='plan'&&t.activeUntil&&t.activeUntil.getTime()>this.now())throw new ExtractionError(429,'chat_ai_busy','Fuzl is already planning for this thread. Wait or cancel your current request.');
    const messages=(await tx.chatMessage.findMany({where:{threadId:id,kind:'person',deletedAt:null},orderBy:{sequence:'desc'},take:40})).reverse();
    const job=await tx.chatRequest.create({data:{id:input.requestId,threadId:id,memberId:me.id,inputHash:hash,kind:input.kind,state:'pending',contentVersion:t.contentVersion,sharedVersion:t.sharedVersion,sessionRevision:session.revision,sourceVersions:json(messages.map(m=>({id:m.id,version:m.changeVersion}))),message:'Working from this thread’s shared context.'}});
    await tx.chatThread.update({where:{id},data:{version:{increment:1},...(input.kind==='plan'?{activeRequestId:job.id,activeUntil:new Date(this.now()+60000)}:{})}});
    return {thread:t,me,sessionRevision:session.revision,messages,job,existing:false};
  });}
  async finish(actor:ChatActor,id:string,jobId:string,result:{plan?:ChatPlan;answer?:PlanAnswer},sourceMap:Record<string,string>={}){return this.locked(id,actor,async(tx,t,me)=>{
    const job=await tx.chatRequest.findFirst({where:{id:jobId,threadId:id,memberId:me.id}});if(!job)throw denied();if(job.state!=='pending')return this.requestDTO(job,t);
    const session=await tx.planningSession.findUniqueOrThrow({where:{id:t.sessionId}}),changed=t.contentVersion!==job.contentVersion||t.sharedVersion!==job.sharedVersion||session.revision!==job.sessionRevision;
    const version=t.version+1,message=changed?'The discussion or plan changed during this request. Nothing was applied. Request a current proposal.':result.plan?'Proposed outing ideas · unreviewed. Review the Plan panel; nothing is booked.':'Answer from the recorded shared plan. No facts were changed.';
    const next=await tx.chatRequest.update({where:{id:jobId},data:{state:changed?'stale':'ready',result:changed?undefined:json(result),sourceMap:json(sourceMap),message}});
    await tx.chatMessage.create({data:{threadId:id,submissionId:randomUUID(),submissionHash:digest(jobId),author:'Fuzl',kind:'fuzl',body:message,requestId:jobId,sequence:t.nextSequence+1,changeVersion:version}});
    await tx.chatThread.update({where:{id},data:{version,nextSequence:{increment:1},...(t.activeRequestId===jobId?{activeRequestId:null,activeUntil:null}:{})}});return this.requestDTO(next,t);
  });}
  async fail(actor:ChatActor,id:string,jobId:string,cancelled:boolean){return this.locked(id,actor,async(tx,t,me)=>{const owned=await tx.chatRequest.findFirst({where:{id:jobId,threadId:id,memberId:me.id}});if(!owned)throw denied();const result=await tx.chatRequest.updateMany({where:{id:jobId,threadId:id,memberId:me.id,state:'pending'},data:{state:cancelled?'cancelled':'failed',message:cancelled?'Request cancelled. An already-started provider call may use quota.':'Fuzl could not complete this request. No plan was replaced; retry deliberately.'}});if(result.count)await tx.chatThread.update({where:{id},data:{version:{increment:1},...(t.activeRequestId===jobId?{activeRequestId:null,activeUntil:null}:{})}});return result.count>0;});}
  async apply(actor:ChatActor,id:string,jobId:string,input:ChatApply){return this.locked(id,actor,async(tx,t,me)=>{
    this.owner(t,me);const job=await tx.chatRequest.findFirst({where:{id:jobId,threadId:id,kind:'plan'}});if(job?.state==='applied'&&(job.result as {acceptedHash?:string})?.acceptedHash===digest(JSON.stringify(input)))return{sessionId:t.sessionId,revision:job.sessionRevision+1};if(!job||job.state!=='ready'||job.contentVersion!==t.contentVersion||job.sharedVersion!==t.sharedVersion||input.contentVersion!==t.contentVersion||input.sharedVersion!==t.sharedVersion)throw stale();
    await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id=${t.sessionId}::uuid FOR UPDATE`;
    if(job.contextHash){const session=await tx.planningSession.findUniqueOrThrow({where:{id:t.sessionId}});const current=await new PlaceStore(this.db).context(t.group.owner.authSubject,t.sessionId,{summary:savedSummarySchema.parse(session.summary),sessionRevision:session.revision});if(current.version!==job.contextHash)throw stale();}
    const result=job.result as {plan:ChatPlan},allowed=result.plan.summary;
    if(input.summary.facts.some(f=>f.guest)||input.summary.organizerDecisions?.length||input.summary.participants.some(p=>!allowed.participants.some(a=>a.id===p.id))||input.summary.sources.some(s=>!allowed.sources.some(a=>a.id===s.id&&a.text===s.text&&a.speakerId===s.speakerId))||input.summary.speakers.some(s=>!allowed.speakers.some(a=>a.id===s.id&&a.participantId===s.participantId)))throw new ExtractionError(422,'chat_shared_sources','Share only reviewed thread facts and unchanged native source references. Private session data cannot be added through this action.');
    const session=await tx.planningSession.findUniqueOrThrow({where:{id:t.sessionId}});if(session.revision!==job.sessionRevision)throw stale();
    const shared=mergeNativeSummary(savedSummarySchema.parse(t.sharedSummary),input.summary),merged=mergeNativeSummary(savedSummarySchema.parse(session.summary),input.summary);
    await tx.planningSession.update({where:{id:t.sessionId},data:{summary:json(supportingSummary(merged)),revision:{increment:1},origin:'ai'}});
    await tx.chatThread.update({where:{id},data:{sharedSummary:json(shared),sharedSources:json({...t.sharedSources as object,...job.sourceMap as object}),sharedVersion:{increment:1},version:{increment:1},contentVersion:{increment:1}}});
    await tx.chatRequest.update({where:{id:jobId},data:{state:'applied',result:json({...result,acceptedHash:digest(JSON.stringify(input))}),message:'Organizer explicitly applied the shared proposal. Published plans and RSVPs are unchanged.'}});
    return {sessionId:t.sessionId,revision:session.revision+1};
  });}
}
