import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { OrganizerStore } from '../accounts/store.js';
import { ChatStore } from './store.js';
import { ChatPlanner } from './planning.js';
import { authoredChatExtraction } from './fixtures.js';
import { createApp } from '../app.js';
import { ExtractionError } from '../extraction/errors.js';
import { GEMINI_MODEL, emptySummary, savedSummarySchema } from '@fuzl/planning';
import type { ChatActor } from '@fuzl/planning';
const enabled=process.env.FUZL_DISPOSABLE_DATABASE==='owned-by-test-runner'&&!!process.env.FUZL_TEST_DATABASE_URL;
const key=()=>Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
test('native conversations: actual PostgreSQL ownership, idempotency, ordering, credentials, SSE, AI receipts, approval and deletion',{skip:!enabled},async t=>{
  const url=process.env.FUZL_TEST_DATABASE_URL!;assert.equal(new URL(url).hostname,'127.0.0.1');const db=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:1},{schema:'fuzl'}),log:[]});t.after(()=>db.$disconnect());
  let now=Date.now();const store=new ChatStore(db,()=>now),owners=new OrganizerStore(db),a=crypto.randomUUID(),b=crypto.randomUUID(),c=crypto.randomUUID();
  const actor:ChatActor={subject:a},other:ChatActor={subject:b};const group=await owners.createGroup(a,{name:'Synthetic Friday friends',aliases:['Editable Sam alias']}),foreign=await owners.createGroup(b,{name:'Other private group',aliases:[]});
  const secretSummary=emptySummary();secretSummary.participants=[{id:'private-person',name:'PRIVATE CANARY'}];secretSummary.speakers=[{id:'private-speaker',label:'PRIVATE CANARY',participantId:'private-person'}];secretSummary.sources=[{id:'private-quote',speakerId:'private-speaker',text:'PRIVATE CANARY: My private limit is USD 17.31.'}];secretSummary.facts=[{id:'private-budget',subject:{kind:'participant',participantId:'private-person'},kind:'budget',amount:17.31,currency:'USD',status:'confirmed',strength:'firm',sourceIds:['private-quote']}];
  const session=await owners.createSession(a,group.id,{title:'Existing private plan',summaryVersion:1,summary:secretSummary,origin:'manual',provenance:[]});
  const create={creationId:crypto.randomUUID(),groupId:group.id,sessionId:session.id,title:'Friday night',displayName:'Alex'},id=await store.create(a,create);assert.equal(await store.create(a,create),id);
  await assert.rejects(store.create(b,{...create,creationId:crypto.randomUUID()}));await assert.rejects(store.create(a,{...create,groupId:foreign.id,creationId:crypto.randomUUID()}));
  const owner=await store.thread(actor,id);assert.equal(owner.me.role,'organizer');assert.equal(owner.sharedSummary.facts.length,0);assert.ok(!JSON.stringify(owner).includes('PRIVATE CANARY'));await assert.rejects(store.thread(other,id));
  const inviteToken=key(),invite=await store.invite(actor,id,{id:crypto.randomUUID(),token:inviteToken,days:7,allowAI:false});const preview=await store.invitePreview(inviteToken);assert.match(preview.history,/earlier history/);assert.ok(!JSON.stringify(preview).includes('private-person'));
  const credential=key(),join={joinId:crypto.randomUUID(),credential,displayName:'Sam',acknowledgeHistory:true as const};const joined=await store.join(inviteToken,null,join);assert.deepEqual(await store.join(inviteToken,null,join),joined);const guest:ChatActor={credential};
  const sameName=await store.join(inviteToken,c,{...join,joinId:crypto.randomUUID()});assert.notEqual(sameName.memberId,joined.memberId);await assert.rejects(store.thread({credential:key()},id));
  const send={submissionId:crypto.randomUUID(),text:'Bowling Friday? My firm budget is USD 25.'};const first=await store.send(actor,id,send);assert.equal((await store.send(actor,id,send)).id,first.id);await assert.rejects(store.send(actor,id,{...send,text:'different text'}));
  const both=await Promise.all([store.send(guest,id,{submissionId:crypto.randomUUID(),text:'Maybe Friday after 7. My limit is USD 20.'}),store.send({subject:c},id,{submissionId:crypto.randomUUID(),text:'Keep the drive at most 20 minutes.'})]);assert.notEqual(both[0].sequence,both[1].sequence);
  const guestView=await store.thread(guest,id);assert.equal(guestView.me.identity,'guest');await assert.rejects(store.rename(guest,id,'Stolen',guestView.version));await assert.rejects(store.invite(guest,id,{id:crypto.randomUUID(),token:key(),days:1,allowAI:true}));await assert.rejects(store.deleteMessage(guest,id,first.id));
  await store.rename(actor,id,'Friday night updated',guestView.version);assert.equal((await store.list(c))[0].title,'Friday night updated');
  let providerCalls=0;const planner=new ChatPlanner(store,async(input)=>{providerCalls++;assert.ok(!input.conversation.includes('17.31'));assert.ok(!input.conversation.includes('PRIVATE'));return authoredChatExtraction(input);},()=>({provider:'gemini',model:GEMINI_MODEL,apiKey:'synthetic-unused-key'}),()=>now);
  let current=await store.thread(actor,id);const request={requestId:crypto.randomUUID(),kind:'plan' as const,contentVersion:current.contentVersion,sharedVersion:current.sharedVersion};
  await assert.rejects(planner.run(guest,id,request,new AbortController().signal));assert.equal(providerCalls,0);
  const result=await planner.run(actor,id,request,new AbortController().signal);assert.equal(result.state,'ready');assert.ok(result.plan);assert.equal(result.plan.summary.participants.length,3);assert.ok(result.plan.suggestions.every(p=>p.status==='needs-checking'));assert.equal(result.plan.summary.facts.find(f=>f.kind==='schedule')?.status,'tentative');assert.equal((await planner.run(actor,id,request,new AbortController().signal)).id,result.id);assert.equal(providerCalls,1,'same request does not call model twice');
  const apply={contentVersion:current.contentVersion,sharedVersion:current.sharedVersion,summary:result.plan.summary,approved:true as const};await assert.rejects(store.apply(guest,id,result.id,apply));const accepted=await store.apply(actor,id,result.id,apply);assert.equal((await store.apply(actor,id,result.id,apply)).revision,accepted.revision);
  current=await store.thread(actor,id);const asked=await planner.run(guest,id,{requestId:crypto.randomUUID(),kind:'question',question:'When is Sam available?',participantId:joined.memberId,contentVersion:current.contentVersion,sharedVersion:current.sharedVersion},new AbortController().signal);assert.match(JSON.stringify(asked.answer),/Maybe Friday after 7/);assert.ok(!JSON.stringify(asked).includes('17.31'));assert.equal(providerCalls,1);
  const owned=await owners.getSession(a,session.id);assert.ok(owned.payload.summary.facts.some(f=>f.id==='private-budget'));assert.ok(owned.payload.summary.facts.some(f=>f.id.startsWith('cf-')));assert.equal(savedSummarySchema.safeParse(owned.payload.summary).success,true);
  await assert.rejects(owners.updateSession(a,session.id,(await owners.createGroup(a,{name:'Different group',aliases:[]})).id,owned.revision,owned.payload),e=>e instanceof ExtractionError&&e.code==='chat_group_bound');
  // A pending AI proposal cannot replace a later message or a newer session.
  let finish:(()=>void)|undefined;const slow=new ChatPlanner(store,async input=>{await new Promise<void>(r=>{finish=r;});return authoredChatExtraction(input);},()=>({provider:'gemini',model:GEMINI_MODEL,apiKey:'synthetic-unused-key'}));current=await store.thread(actor,id);
  const work=slow.run(actor,id,{requestId:crypto.randomUUID(),kind:'plan',contentVersion:current.contentVersion,sharedVersion:current.sharedVersion},new AbortController().signal);for(let n=0;n<100&&!finish;n++)await new Promise(r=>setTimeout(r,5));assert.ok(finish);await store.send(guest,id,{submissionId:crypto.randomUUID(),text:'Actually maybe after 8; keep it tentative.'});finish();assert.equal((await work).state,'stale');
  current=await store.thread(actor,id);const reviewReceipt=await planner.run(actor,id,{requestId:crypto.randomUUID(),kind:'plan',contentVersion:current.contentVersion,sharedVersion:current.sharedVersion},new AbortController().signal);assert.ok(reviewReceipt.plan);
  const privateEdit=await owners.getSession(a,session.id);await owners.updateSession(a,session.id,group.id,privateEdit.revision,{...privateEdit.payload,title:'Privately edited while reviewing'});
  await assert.rejects(store.apply(actor,id,reviewReceipt.id,{contentVersion:current.contentVersion,sharedVersion:current.sharedVersion,summary:reviewReceipt.plan.summary,approved:true}));
  for(let i=0;i<54;i++)await store.send(actor,id,{submissionId:crypto.randomUUID(),text:`Synthetic history ${i}`});const recent=await store.page(guest,id);assert.equal(recent.messages.length,50);assert.equal(recent.hasOlder,true);const older=await store.page(guest,id,{before:recent.messages[0].sequence});assert.ok(older.messages.length>0);assert.ok(older.messages.every(m=>m.sequence<recent.messages[0].sequence));assert.deepEqual([...recent.messages].sort((x,y)=>x.sequence-y.sequence),recent.messages);
  const app=createApp({chat:{store:()=>store,verify:async token=>{if(token==='synthetic-owner-access-token')return a;if(token==='synthetic-other-access-token')return b;throw new ExtractionError(401,'expired','Session expired');},streamIntervalMs:25,streamDurationMs:350}}),server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/chat`;
  assert.equal((await fetch(base+`/threads/${id}`,{headers:{Authorization:'Bearer synthetic-other-access-token'}})).status,403);assert.equal((await fetch(base+`/threads/${id}`,{headers:{'X-Chat-Credential':credential,Origin:'https://attacker.invalid'}})).status,403);
  const events=await fetch(base+`/threads/${id}/events`,{headers:{'X-Chat-Credential':credential}});assert.equal(events.headers.get('content-type')?.startsWith('text/event-stream'),true);await store.send(actor,id,{submissionId:crypto.randomUUID(),text:'A live database-backed notification.'});const eventText=await events.text();assert.match(eventText,/event: sync/);assert.ok(!eventText.includes('notification.'));
  // Removal and revocation affect reads, writes, subscriptions and AI actions.
  const live=await fetch(base+`/threads/${id}/events`,{headers:{'X-Chat-Credential':credential}});await store.remove(actor,id,joined.memberId);assert.match(await live.text(),/event: revoked/);await assert.rejects(store.page(guest,id));await assert.rejects(store.send(guest,id,{submissionId:crypto.randomUUID(),text:'forbidden'}));await assert.rejects(store.join(inviteToken,null,join));
  await store.revoke(actor,id,invite.id);await assert.rejects(store.thread({subject:c},id));await assert.rejects(store.invitePreview(inviteToken));
  // Deleting a native source removes derived facts/quotes, not published plans.
  await store.deleteMessage(actor,id,first.id);const afterDelete=await store.thread(actor,id);assert.ok(afterDelete.requests.every(r=>r.plan===null&&r.answer===null));const tombstone=(await store.page(actor,id,{changesAfter:0})).messages.find(m=>m.id===first.id);assert.equal(tombstone?.text,null);assert.equal(tombstone?.deleted,true);assert.ok(!(JSON.stringify((await owners.getSession(a,session.id)).payload.summary)).includes('Bowling Friday?'));
  const expireToken=key(),expiring=await store.invite(actor,id,{id:crypto.randomUUID(),token:expireToken,days:1,allowAI:false});assert.ok(expiring.expiresAt);const expireCredential=key();await store.join(expireToken,null,{joinId:crypto.randomUUID(),credential:expireCredential,displayName:'Expiry fixture',acknowledgeHistory:true});now+=2*86400000;await assert.rejects(store.thread({credential:expireCredential},id));await assert.rejects(store.invitePreview(expireToken));
  const rls=await db.$queryRaw<{relrowsecurity:boolean}[]>`SELECT relrowsecurity FROM pg_class WHERE relname LIKE 'fuzl_chat_%' AND relkind='r'`;assert.equal(rls.length,5);assert.ok(rls.every(r=>r.relrowsecurity));
  for(const role of ['anon','authenticated'])for(const table of ['fuzl_chat_threads','fuzl_chat_members','fuzl_chat_invites','fuzl_chat_messages','fuzl_chat_requests'])await assert.rejects(db.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);return tx.$queryRawUnsafe(`SELECT id FROM fuzl.${table} LIMIT 1`);}));
});

test('native thread → reviewed plan → shortlist → vote → published plan → RSVP; later budget and availability stay explicit',{skip:!enabled},async t=>{
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.FUZL_TEST_DATABASE_URL!},{schema:'fuzl'}),log:[]});t.after(()=>db.$disconnect());
  const {BallotStore}=await import('../ballots/store.js'),{PlanStore}=await import('../plans/store.js');
  const {assessIdeaOptions,manualPlaces,unknownHours,shortlistPlace}=await import('@fuzl/planning');
  const subject=crypto.randomUUID(),actor:ChatActor={subject},owners=new OrganizerStore(db),chat=new ChatStore(db),ballots=new BallotStore(db),plans=new PlanStore(db);
  const group=await owners.createGroup(subject,{name:'Synthetic full-flow group',aliases:[]});const id=await chat.create(subject,{creationId:crypto.randomUUID(),groupId:group.id,title:'Saturday outing',displayName:'Alex'});let current=await chat.thread(actor,id);
  const inviteToken=key();await chat.invite(actor,id,{id:crypto.randomUUID(),token:inviteToken,days:7,allowAI:false});const credential=key();await chat.join(inviteToken,null,{joinId:crypto.randomUUID(),credential,displayName:'Sam',acknowledgeHistory:true});const guest:ChatActor={credential};
  await chat.send(actor,id,{submissionId:crypto.randomUUID(),text:'Bowling Friday? My budget is USD 30.'});await chat.send(guest,id,{submissionId:crypto.randomUUID(),text:'Maybe Friday after 7. My firm limit is USD 20.'});
  const planner=new ChatPlanner(chat,async input=>authoredChatExtraction(input),()=>({provider:'gemini',model:GEMINI_MODEL,apiKey:'synthetic-unused'}));
  async function proposal(){current=await chat.thread(actor,id);return planner.run(actor,id,{requestId:crypto.randomUUID(),kind:'plan',contentVersion:current.contentVersion,sharedVersion:current.sharedVersion},new AbortController().signal);}
  async function apply(result:Awaited<ReturnType<typeof proposal>>){assert.ok(result.plan);return chat.apply(actor,id,result.id,{contentVersion:result.contentVersion,sharedVersion:result.sharedVersion,summary:result.plan.summary,approved:true});}
  const first=await proposal();await apply(first);current=await chat.thread(actor,id);
  const supplied=manualPlaces([{name:'Synthetic bowling',address:null,category:'bowling',sourceUrl:null,price:{amount:25,currency:'USD',basis:'per-person',coverage:'total'},hours:{...unknownHours},lat:null,lon:null,timeZone:null}],new Date().toISOString());
  assert.equal(assessIdeaOptions(supplied,current.sharedSummary)[0].status,'does-not-fit','Sam’s source-reported firm 20 excludes a known 25 total');
  const option={...shortlistPlace(first.plan!.suggestions[0],crypto.randomUUID()),kind:'idea' as const};
  const session=await owners.getSession(subject,current.sessionId);await ballots.save(subject,current.sessionId,{content:{title:'Synthetic outing options',options:[option,{...option,id:crypto.randomUUID(),name:'Second synthetic idea'}]},revision:0,sessionRevision:session.revision});
  const ballotToken=key(),published=await ballots.publish(subject,current.sessionId,{publicationId:crypto.randomUUID(),inviteToken:ballotToken,expectedBallotId:null,shortlistRevision:1,sessionRevision:session.revision,approved:true,days:7});
  const voteEdit=key();await ballots.submit(ballotToken,{submissionId:crypto.randomUUID(),editToken:voteEdit,optionId:option.id});await assert.rejects(ballots.submit(credential,{submissionId:crypto.randomUUID(),editToken:key(),optionId:option.id}),'chat credentials cannot vote');
  let plan=await plans.select(subject,current.sessionId,{requestId:crypto.randomUUID(),revision:0,sessionRevision:session.revision,ballotId:published.ballot.id,optionId:option.id});assert.ok(plan);
  plan=await plans.save(subject,current.sessionId,{requestId:crypto.randomUUID(),revision:plan.revision,details:{...plan.draft.details,date:'2026-12-05',time:'18:00',timeZone:'America/New_York',meetingPoint:'Synthetic bowling front desk',booking:'needs-booking'}});assert.ok(plan);
  plan=await plans.publish(subject,current.sessionId,{requestId:crypto.randomUUID(),revision:plan.revision,approved:true,previewKey:plan.draftKey,notice:'Synthetic group agreement; no booking made.'});assert.ok(plan);
  const sharedToken=key();await plans.link(subject,current.sessionId,{requestId:crypto.randomUUID(),revision:plan.revision,token:sharedToken,days:7,replace:false});const publicBefore=await plans.page(sharedToken);
  const response=await plans.submit(sharedToken,{submissionId:crypto.randomUUID(),editToken:key(),payload:{alias:'Sam',choice:'going',planVersion:publicBefore.version,approved:true}});assert.equal(response.needsReconfirmation,false);
  await chat.send(guest,id,{submissionId:crypto.randomUUID(),text:'Correction: my firm budget is USD 30. Maybe Friday after 8.'});const next=await proposal();assert.ok(next.plan);assert.equal((await chat.thread(actor,id)).sharedVersion,current.sharedVersion,'later message cannot auto-apply');await apply(next);current=await chat.thread(actor,id);
  const rechecked=assessIdeaOptions(supplied,current.sharedSummary)[0];assert.notEqual(rechecked.status,'does-not-fit','approved correction reaches the same fit checker');assert.equal(rechecked.status,'needs-checking','unknown hours/travel/date never turn into a verified fit');assert.deepEqual(await plans.page(sharedToken),publicBefore,'chat update cannot revise an immutable published plan or RSVP');
  const dashboard=await plans.get(subject,current.sessionId);assert.equal(dashboard?.counts.going,1);
  await assert.rejects(chat.prepareReview({credential:key()},id,{contentVersion:current.contentVersion,sharedVersion:current.sharedVersion}));
  const correction=await chat.prepareReview(actor,id,{contentVersion:current.contentVersion,sharedVersion:current.sharedVersion});assert.match(correction.message,/no AI request/);assert.ok(correction.plan);await chat.apply(actor,id,correction.id,{contentVersion:current.contentVersion,sharedVersion:current.sharedVersion,summary:correction.plan.summary,approved:true});assert.deepEqual(await plans.page(sharedToken),publicBefore);

  await assert.rejects(chat.invitations(guest,id));assert.ok((await chat.invitations(actor,id)).every(i=>!JSON.stringify(i).includes(inviteToken)));
  // Another member cannot cancel an organizer request, including after completion.
  await assert.rejects(planner.cancel(guest,id,next.id));
});

test('hosted beta uses persistent account quotas, cross-instance concurrency and an explicit Nashville destination',{skip:!enabled},async t=>{
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.FUZL_TEST_DATABASE_URL!},{schema:'fuzl'}),log:[]});t.after(()=>db.$disconnect());
 const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';t.after(()=>{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;});
 let now=Date.now();const subject=crypto.randomUUID(),actor={subject},owners=new OrganizerStore(db),store=new ChatStore(db,()=>now),otherInstance=new ChatStore(db,()=>now);
 const group=await owners.createGroup(subject,{name:'Synthetic Nashville quota check',aliases:[]});
 const ids=await Promise.all([0,1,2,3].map(i=>store.create(subject,{creationId:crypto.randomUUID(),groupId:group.id,title:`Nashville ${i}`,displayName:'Synthetic organizer',destination:{label:'Nashville, TN',timeZone:'America/Chicago'}})));
 const thread=await store.thread(actor,ids[0]);assert.deepEqual(thread.destination,{label:'Nashville, TN',timeZone:'America/Chicago'});
 assert.match((await store.page(actor,ids[0])).messages[0].text!,/Nashville, TN.*America\/Chicago/);
 const request=()=>({requestId:crypto.randomUUID(),kind:'plan' as const,contentVersion:1,sharedVersion:0});const first=request(),second=request();
 await store.begin(actor,ids[0],first);await otherInstance.begin(actor,ids[1],second);
 assert.equal((await otherInstance.begin(actor,ids[0],first)).existing,true,'receipt replay never acquires another lease');
 await assert.rejects(otherInstance.begin(actor,ids[2],request()),(e:unknown)=>e instanceof ExtractionError&&e.code==='chat_ai_busy');
 await db.aiRequestLease.updateMany({where:{authSubject:subject},data:{expiresAt:new Date(now)}});
 await otherInstance.begin(actor,ids[2],request());
 await assert.rejects(store.begin(actor,ids[3],request()),(e:unknown)=>e instanceof ExtractionError&&e.code==='chat_ai_limit');
 assert.equal(await db.aiRequestLease.count({where:{authSubject:subject}}),3);
 await db.aiRequestLease.createMany({data:Array.from({length:17},()=>({id:crypto.randomUUID(),authSubject:subject,createdAt:new Date(now-600000),expiresAt:new Date(now-600000)}))});
 await owners.deleteGroup(subject,group.id);now+=61000;
 const nextGroup=await owners.createGroup(subject,{name:'New group cannot reset quota',aliases:[]});const nextId=await store.create(subject,{creationId:crypto.randomUUID(),groupId:nextGroup.id,title:'Next outing',displayName:'Synthetic organizer'});
 await assert.rejects(store.begin(actor,nextId,request()),(e:unknown)=>e instanceof ExtractionError&&e.code==='chat_ai_limit');
 await assert.rejects(store.thread({subject:crypto.randomUUID()},nextId));
 assert.equal(await db.aiRequestLease.count({where:{authSubject:subject}}),20);
 await owners.deleteGroup(subject,nextGroup.id);await db.aiRequestLease.deleteMany({where:{authSubject:subject}});
});
