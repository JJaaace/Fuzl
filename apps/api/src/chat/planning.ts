import { PlaceStore } from '../places/store.js';
import { analysisResponseSchema, answerRecordedPlan, assessIdeaOptions, chatPlanResultSchema, emptySummary, ideaChoices, manualPlaces, savedSummarySchema, summaryReferencesValid } from '@fuzl/planning';
import type { AnalysisRequest, AnalysisResponse, PlanningSummary, PlanningFact, ChatRequestInput } from '@fuzl/planning';
import type { ChatActor } from '@fuzl/planning';
import { extractConversation } from '../extraction/provider.js';
import { ensureAIConfigured } from '../extraction/configuration.js';
import { ExtractionError } from '../extraction/errors.js';
import { ChatStore, digest } from './store.js';
import type { ChatSnapshot } from './store.js';
import { mergeNativeSummary } from './summary.js';
export type ChatExtractor=(input:AnalysisRequest,signal:AbortSignal)=>Promise<AnalysisResponse>;
export function nativeContext(snapshot:ChatSnapshot){
  const lines:{messageId:string;memberId:string;label:string;text:string}[]=[];let length=0;
  for(const message of [...snapshot.messages].reverse()){
    if(!message.body||message.deletedAt||message.kind!=='person'||!message.memberId||/^@fuzl\b/i.test(message.body.trim()))continue;
    const label=`Member_${message.memberId.replaceAll('-','')}`;
    // JSON quoting keeps embedded newlines from impersonating another sender.
    const text=`${label}: ${JSON.stringify(message.body)}`;
    if(length+text.length+1>6000)break;
    lines.unshift({messageId:message.id,memberId:message.memberId,label,text});length+=text.length+1;
  }
  return{conversation:lines.map(line=>line.text).join('\n'),lines};
}
export function bindNativeSummary(summary:PlanningSummary,snapshot:ChatSnapshot,context:ReturnType<typeof nativeContext>){
  const prefix=(tag:string,id:string)=>`${tag}-${digest(snapshot.job.id+id).slice(0,24)}`;
  const members=new Map(snapshot.thread.members.map(m=>[m.id,m]));
  const speakerMap=new Map<string,string>(),personMap=new Map<string,string>(),sourceMap:Record<string,string>={};
  const sources:PlanningSummary['sources']=[];
  for(const speaker of summary.speakers){
    const line=context.lines.find(l=>l.label===speaker.label);
    if(!line)throw new ExtractionError(502,'chat_source_invalid','Fuzl could not bind an extracted speaker to a native message. No proposal was accepted.');
    const member=members.get(line.memberId)!;speakerMap.set(speaker.id,`csp-${member.id}`);if(speaker.participantId){const stable=member.planningParticipantId??member.id;if(personMap.has(speaker.participantId)&&personMap.get(speaker.participantId)!==stable)throw new ExtractionError(502,'chat_source_invalid','One extracted person was attributed to different conversation identities. No proposal was accepted.');personMap.set(speaker.participantId,stable);}
  }
  if(summary.participants.some(p=>!personMap.has(p.id)))throw new ExtractionError(502,'chat_source_invalid','An extracted person has no native sender identity. No proposal was accepted.');
  const sourceIds=new Map<string,string>();
  for(const source of summary.sources){
    const speaker=summary.speakers.find(s=>s.id===source.speakerId),line=context.lines.find(l=>l.label===speaker?.label&&l.text.includes(source.text));
    if(!line)throw new ExtractionError(502,'chat_source_invalid','A source quote did not belong to its recorded sender and message. No proposal was accepted.');
    const id=prefix('cs',source.id);sourceIds.set(source.id,id);sourceMap[id]=line.messageId;sources.push({id,speakerId:speakerMap.get(source.speakerId)!,text:source.text});
  }
  const facts:PlanningFact[]=summary.facts.map(f=>{
    if(f.guest||!f.sourceIds.length||f.sourceIds.some(id=>!sourceIds.has(id)))throw new ExtractionError(502,'chat_source_invalid','A native claim is missing its message evidence. No proposal was accepted.');
    const subject=f.subject.kind==='speaker'?{kind:'speaker' as const,speakerId:speakerMap.get(f.subject.speakerId)!}:f.subject.kind==='participant'?{kind:'participant' as const,participantId:personMap.get(f.subject.participantId)!}:f.subject;
    if((subject.kind==='speaker'||subject.kind==='participant')&&f.sourceIds.some(id=>{const original=summary.sources.find(source=>source.id===id)!;return subject.kind==='speaker'?speakerMap.get(original.speakerId)!==subject.speakerId:!summary.speakers.some(s=>s.id===original.speakerId&&s.participantId&&personMap.get(s.participantId)===subject.participantId);}))throw new ExtractionError(502,'chat_source_invalid','A personal claim did not have evidence from that conversation identity. No proposal was accepted.');
    return{...f,id:prefix('cf',f.id),subject,sourceIds:f.sourceIds.map(id=>sourceIds.get(id)!),...(f.extraction?{extraction:{...f.extraction,reviewed:false,supersedes:f.extraction.supersedes.map(id=>prefix('cf',id))}}:{})};
  });
  const value:PlanningSummary={...emptySummary(),participants:[...new Map([...personMap.values()].map(id=>{const member=snapshot.thread.members.find(m=>(m.planningParticipantId??m.id)===id)!;return[id,{id,name:member.displayName}];})).values()],speakers:[...new Map(summary.speakers.map(s=>[speakerMap.get(s.id)!,{id:speakerMap.get(s.id)!,label:s.label,participantId:s.participantId?personMap.get(s.participantId)??null:null}])).values()],sources,facts,questions:summary.questions.map(q=>({...q,id:prefix('cq',q.id),relatedFactIds:q.relatedFactIds.map(id=>prefix('cf',id)),resolution:null}))};
  const parsed=savedSummarySchema.safeParse(value);if(!parsed.success||!summaryReferencesValid(value))throw new ExtractionError(502,'chat_source_invalid','The native proposal could not preserve valid participant and source references.');return{summary:parsed.data,sourceMap};
}
export class ChatPlanner{
  private running=new Map<string,AbortController>();
  private attempts:{at:number;member:string}[]=[];
  private total=0;
  constructor(private store:ChatStore,private extract:ChatExtractor=extractConversation,private check=ensureAIConfigured,private now=Date.now){}
  async run(actor:ChatActor,id:string,input:ChatRequestInput,outer:AbortSignal){
    const snapshot=await this.store.begin(actor,id,input);
    if(snapshot.existing)return this.store.requestDTO(snapshot.job,snapshot.thread);
    const controller=new AbortController(),abort=()=>controller.abort();outer.addEventListener('abort',abort,{once:true});this.running.set(input.requestId,controller);
    try{
      if(input.kind==='question'){
        const shared=savedSummarySchema.parse(snapshot.thread.sharedSummary),answer=answerRecordedPlan(shared,input.question!,input.participantId);
        return await this.store.finish(actor,id,input.requestId,{answer},snapshot.thread.sharedSources as Record<string,string>);
      }
      const time=this.now();this.attempts=this.attempts.filter(a=>time-a.at<60000);
      if(process.env.NODE_ENV!=='production'&&(this.total>=10||this.attempts.filter(a=>a.member===snapshot.me.id).length>=3))throw new ExtractionError(429,'chat_ai_limit','The development AI limit was reached. Wait for the minute limit or review usage before restarting; no automatic retry.');
      const config=this.check();if(config.provider!=='gemini')throw new ExtractionError(503,'chat_gemini_required','Select Gemini on the backend for conversation planning. No other provider was called.');
      const privateSession=await this.store.db.planningSession.findUniqueOrThrow({where:{id:snapshot.thread.sessionId}}),privateSummary=savedSummarySchema.parse(privateSession.summary),privateStore=new PlaceStore(this.store.db,this.now);
      const baseline=await privateStore.context(snapshot.thread.group.owner.authSubject,snapshot.thread.sessionId,{summary:privateSummary,sessionRevision:snapshot.sessionRevision});
      const context=nativeContext(snapshot);await this.store.db.chatRequest.update({where:{id:input.requestId},data:{contextHash:baseline.version,sourceVersions:context.lines.map(line=>({id:line.messageId,version:snapshot.messages.find(m=>m.id===line.messageId)!.changeVersion}))}});if(!context.lines.length)throw new ExtractionError(422,'chat_messages_needed','Add an outing message first. Questions and Fuzl responses are not extracted as new claims.');
      this.total++;this.attempts.push({at:time,member:snapshot.me.id});
      const response=analysisResponseSchema.parse(await this.extract({conversation:context.conversation,expectedProvider:'gemini',referenceDate:input.referenceDate??null},AbortSignal.any([controller.signal,AbortSignal.timeout(50000)])));
      // Operational evidence only: no message, participant, private constraint,
      // authorization header or provider response body enters logs.
      if(process.env.NODE_ENV==='production')console.info(JSON.stringify({event:'chat_plan_provider_completed',requestId:input.requestId,metrics:response.metrics}));
      if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
      const bound=bindNativeSummary(response.summary,snapshot,context),shared=mergeNativeSummary(savedSummarySchema.parse(snapshot.thread.sharedSummary),bound.summary);
      const candidates=manualPlaces(ideaChoices(shared,undefined,0).map(c=>c.candidate),new Date(this.now()).toISOString());
      const checking=mergeNativeSummary(privateSummary,bound.summary),owned=await privateStore.context(snapshot.thread.group.owner.authSubject,snapshot.thread.sessionId,{summary:checking,sessionRevision:snapshot.sessionRevision});
      const checked=assessIdeaOptions(candidates,owned.checkingSummary??checking,{privateSpending:owned.privateSpending,memories:owned.memories,history:owned.visitHistory,participation:owned.participation,travel:owned.travel});
      const publicOptions=assessIdeaOptions(candidates,shared);
      const suggestions=checked.map(privateResult=>{const publicOption=publicOptions.find(c=>c.candidate.id===privateResult.candidate.id)!;return privateResult?.status==='does-not-fit'?{...publicOption,status:'does-not-fit' as const,checks:[{kind:'constraint' as const,status:'does-not-fit' as const,detail:'This option cannot be treated as a fit. Ask the organizer to review the current constraints.'}]}:publicOption;});
      const latest=await privateStore.context(snapshot.thread.group.owner.authSubject,snapshot.thread.sessionId,{summary:privateSummary,sessionRevision:snapshot.sessionRevision});if(latest.version!==baseline.version)throw new ExtractionError(409,'chat_private_context_stale','Planning constraints changed during generation. No current proposal was accepted.');
      const plan=chatPlanResultSchema.parse({summary:shared,suggestions,followUp:shared.questions.find(q=>q.resolution===null)?.text??'Choose an idea, then check its venue, cost, timing and travel before agreeing.',usedMessages:context.lines.length});
      return await this.store.finish(actor,id,input.requestId,{plan},{...snapshot.thread.sharedSources as Record<string,string>,...bound.sourceMap});
    }catch(error){await this.store.fail(actor,id,input.requestId,controller.signal.aborted).catch(()=>{});if(error instanceof ExtractionError)throw error;if(controller.signal.aborted)throw new ExtractionError(499,'chat_cancelled','Request cancelled; already-started AI may use quota. Your messages and plan were kept.');throw new ExtractionError(502,'chat_generation_failed','Fuzl could not verify a response. Your messages and plan were kept; retry deliberately.');}
    finally{if(process.env.NODE_ENV==='production')await this.store.db.aiRequestLease.updateMany({where:{id:input.requestId},data:{expiresAt:new Date(this.now())}}).catch(()=>{});outer.removeEventListener('abort',abort);this.running.delete(input.requestId);}
  }
  async cancel(actor:ChatActor,id:string,requestId:string){if(await this.store.fail(actor,id,requestId,true))this.running.get(requestId)?.abort();}
}
