import { GuestStore } from '../guests/store.js';
import { ParticipationStore } from '../participation/store.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { OrganizerStore } from '../accounts/store.js';
import { BallotStore } from '../ballots/store.js';
import { PlanStore } from '../plans/store.js';
import { OutingStore } from '../outings/store.js';
import { PlaceStore } from '../places/store.js';
import { TravelStore } from './store.js';
import { createApp } from '../app.js';
import { travelFixture, evaluatePlaces, summaryForScope, shortlistPlace, placeResultsSchema, travelDashboardSchema } from '@fuzl/planning';
const enabled=process.env.FUZL_DISPOSABLE_DATABASE==='owned-by-test-runner'&&!!process.env.FUZL_TEST_DATABASE_URL;
const id=()=>randomUUID(),token=()=>randomBytes(32).toString('base64url');
test('10.5 disposable completed travel records → current scoped estimates → private ranking → corrections/deletion/isolation', {skip:!enabled},async t=>{
  const url=process.env.FUZL_TEST_DATABASE_URL!;assert.equal(new URL(url).hostname,'127.0.0.1');const db=new PrismaClient({adapter:new PrismaPg({connectionString:url},{schema:'fuzl'}),log:[]});t.after(()=>db.$disconnect());
  const f=travelFixture(),clock=()=>f.travel.now,owner=id(),other=id(),accounts=new OrganizerStore(db),ballots=new BallotStore(db,clock),plans=new PlanStore(db,clock),outings=new OutingStore(db,clock),travel=new TravelStore(db,clock),places=new PlaceStore(db,clock);
  const group=await accounts.createGroup(owner,{name:'Synthetic travel group',aliases:f.summary.participants.map(p=>p.name!)}),foreign=await accounts.createGroup(owner,{name:'Synthetic isolated group',aliases:f.summary.participants.map(p=>p.name!)});t.after(async()=>{await accounts.deleteGroup(owner,group.id);await accounts.deleteGroup(owner,foreign.id);});
  const summary=structuredClone(f.summary);summary.facts.push({id:'explicit-all-available',kind:'schedule',subject:{kind:'group'},status:'confirmed',strength:'firm',sourceIds:[],exactDate:f.window.date,description:f.window.date,startTime:f.window.start,endTime:f.window.end});
  const payload={title:'Synthetic travel session',summaryVersion:1 as const,origin:'manual' as const,provenance:[],summary};const saved=await accounts.createSession(owner,group.id,payload),isolated=await accounts.createSession(owner,foreign.id,payload);
  const baseFit=evaluatePlaces(f.candidates,f.area,f.query,summaryForScope(f.summary,f.scope),[],[],undefined,f.scope),option=shortlistPlace(baseFit.verified[0],id());const recorded:string[]=[];
  for(const date of ['2026-11-01','2026-11-07']){
    const s=await accounts.createSession(owner,group.id,payload);recorded.push(s.id);await ballots.save(owner,s.id,{revision:0,sessionRevision:1,content:{title:'Synthetic completed outing',options:[option]}});const ballot=await ballots.publish(owner,s.id,{publicationId:id(),inviteToken:token(),expectedBallotId:null,shortlistRevision:1,sessionRevision:1,approved:true,days:14});let p=(await plans.select(owner,s.id,{requestId:id(),revision:0,sessionRevision:1,ballotId:ballot.ballot.id,optionId:option.id}))!;p=(await plans.save(owner,s.id,{requestId:id(),revision:p.revision,details:{...p.draft.details,date,time:'19:00',timeZone:f.window.timeZone,meetingPoint:'Synthetic gate'}}))!;p=(await plans.publish(owner,s.id,{requestId:id(),revision:p.revision,previewKey:p.draftKey,approved:true,notice:'Synthetic completed plan'}))!;await outings.complete(owner,s.id,{requestId:id(),revision:p.revision,actual:{activity:option.name,date,time:'19:00',timeZone:f.window.timeZone,meetingPoint:'Synthetic gate'},sameListing:true,confirmedAttendees:[],approved:true});
  }
  const source=(await travel.get(owner,saved.id));const setup=structuredClone(f.travel.setup);setup.mappings.forEach((m,i)=>m.aliasId=group.aliases[i].id);
  const makeHistory=()=>({...structuredClone(f.travel.outings[0].history),attendees:group.aliases.map((a,i)=>({aliasId:a.id,attended:true as const,minutes:[50,20,120][i]}))});
  let revision=source.revision;
  async function saveSetup(){const d=await travel.get(owner,saved.id);const input={revision:d.revision,requestId:id(),sessionRevision:1,scopeKey:d.scope.key,setup};const next=await travel.save(owner,saved.id,input);revision=next.revision;return input;}
  await t.test('optional history requires explicit attendance and completed owned outing; current setup retries are idempotent',async()=>{
    assert.equal(source.outings.length,2);assert.ok(source.outings.every(o=>o.history===null));assert.equal((await travel.get(owner,isolated.id)).outings.length,0);await assert.rejects(travel.get(other,saved.id));
    await assert.rejects(travel.history(owner,saved.id,{revision:1,requestId:id(),history:makeHistory()}));
    for(const s of recorded){const r=(await outings.get(owner,s))!;const edit={revision:r.revision,requestId:id(),history:makeHistory()};await travel.history(owner,s,edit);await travel.history(owner,s,edit);assert.deepEqual((await outings.get(owner,s))!.confirmedAttendees,[]);}
    const historical=(await outings.get(owner,recorded[0]))!;await assert.rejects(travel.history(owner,recorded[0],{revision:historical.revision,requestId:id(),history:{...makeHistory(),attendees:[{aliasId:foreign.aliases[0].id,attended:true,minutes:10}]}}));
    const input=await saveSetup();await travel.save(owner,saved.id,input);assert.equal((await travel.get(owner,saved.id)).revision,revision);await assert.rejects(travel.save(owner,saved.id,{...input,setup:{...setup,mode:'driving'}}));
    await assert.rejects(travel.save(owner,saved.id,{...input,requestId:id(),revision,setup:{...setup,mappings:[{...setup.mappings[0],aliasId:foreign.aliases[0].id}]}}));
  });
  let providerCalls=0;let duringSearch:(()=>Promise<void>)|undefined;
  const server=createApp({accounts:{verify:async auth=>auth==='synthetic-owner-token'?owner:other,travel:{store:()=>travel},places:{store:()=>places,now:clock,provider:{search:async()=>{providerCalls++;await duringSearch?.();return{area:f.area,candidates:f.candidates};}}}}}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/private/sessions/${saved.id}`;
  let searchId='';const request={mode:'live',sessionRevision:1,summary,query:f.query,manual:[]};
  async function search(recheck=false){const response=await fetch(base+'/places/'+(recheck?'evaluate':'search'),{method:'POST',headers:{Authorization:'Bearer synthetic-owner-token','Content-Type':'application/json'},body:JSON.stringify({...request,...(recheck?{searchId}:{})})});assert.equal(response.status,200);const result=placeResultsSchema.parse(await response.json());assert.ok(result.searchId);searchId=result.searchId;return result;}
  await t.test('normal search returns generic hints only; private budgets and provider inputs stay separate',async()=>{
    const result=await search();assert.deepEqual(result.verified.map((r:{candidate:{id:string}})=>r.candidate.id),['a-usual','b-balanced']);assert.deepEqual(result.verified[1].travelBalance,['demo:a-usual']);assert.equal(result.excluded[0].candidate.id,'c-budget');for(const secret of ['aliasId','attendees','synthetic-private-minutes',group.aliases[0].id])assert.ok(!JSON.stringify(result).includes(secret));assert.equal(providerCalls,1);
    const ownerPage=await fetch(base+'/travel',{headers:{Authorization:'Bearer synthetic-owner-token'}});assert.equal(ownerPage.status,200);assert.equal(travelDashboardSchema.parse(await ownerPage.json()).outings.length,2);
    const context=await places.context(owner,saved.id,request as Parameters<typeof places.context>[2]);assert.ok(context.travel);const foreignContext=await places.context(owner,isolated.id,request as Parameters<typeof places.context>[2]);assert.equal(foreignContext.travel,undefined);
  });
  await t.test('correction/deletion changes server context and rechecks loaded candidates without another provider request',async()=>{
    const before=await places.context(owner,saved.id,request as Parameters<typeof places.context>[2]);const row=(await outings.get(owner,recorded[0]))!;await travel.history(owner,recorded[0],{revision:row.revision,requestId:id(),history:null});const after=await places.context(owner,saved.id,request as Parameters<typeof places.context>[2]);assert.notEqual(before.version,after.version);assert.equal(before.baselineVersion,after.baselineVersion);const result=await search(true);assert.ok(result.verified.every((r:{travelBalance?:string[]})=>!r.travelBalance));assert.equal(providerCalls,1);
    let r=(await outings.get(owner,recorded[0]))!;const history=makeHistory();history.attendees.forEach(a=>a.minutes=40);await travel.history(owner,recorded[0],{revision:r.revision,requestId:id(),history});r=(await outings.get(owner,recorded[1]))!;await travel.history(owner,recorded[1],{revision:r.revision,requestId:id(),history});const corrected=await search(true);assert.ok(corrected.verified.every((r:{travelBalance?:string[]})=>!r.travelBalance));assert.equal(providerCalls,1);
  });
  await t.test('reviewed opt-in subset invalidates old travel proof and uses only mapped current attendees, while their private firm budgets still exclude',async()=>{
    // Restore comparable history before demonstrating the changed roster.
    for(const sessionId of recorded){const row=(await outings.get(owner,sessionId))!;await travel.history(owner,sessionId,{revision:row.revision,requestId:id(),history:makeHistory()});}
    const scopes=new ParticipationStore(db,clock),guests=new GuestStore(db,clock);let dashboard=await scopes.get(owner,saved.id);
    const made=await scopes.window(owner,saved.id,{revision:dashboard.revision,sessionRevision:1,requestId:id(),approved:true,window:f.window,replace:false,inviteToken:token()});dashboard=made.dashboard;
    const form=await guests.form(made.token);const people:{responseId:string;edit:string;payload:{alias:string;answers:{questionId:string;kind:'budget';state:'known';amount:number;currency:string;visibility:'private'}[]}}[]=[];
    for(let i=0;i<3;i++){const edit=token(),payload={alias:f.summary.participants[i].name!,answers:[{questionId:form.questions[0].id,kind:'budget' as const,state:'known' as const,amount:i===2?.17:100,currency:'USD',visibility:'private' as const}]};const reply=await guests.submit(made.token,{submissionId:id(),editToken:edit,payload});await scopes.reply(made.token,edit,{requestId:id(),revision:0,choice:'yes'});people.push({responseId:reply.id,edit,payload});}
    async function review(){dashboard=await scopes.get(owner,saved.id);dashboard=await scopes.review(owner,saved.id,{revision:dashboard.revision,sessionRevision:1,requestId:id(),approved:true,expectedKey:dashboard.scope.key,mappings:people.map((p,i)=>({responseId:p.responseId,participantId:f.summary.participants[i].id})),selected:f.summary.participants.slice(0,2).map(p=>p.id),mode:'available'});}
    await review();let context=await places.context(owner,saved.id,request as Parameters<typeof places.context>[2]);assert.equal(context.travel,undefined);await saveSetup();context=await places.context(owner,saved.id,request as Parameters<typeof places.context>[2]);assert.equal(context.participation?.attendeeCount,2);assert.equal(context.privateSpending.length,2);
    const result=evaluatePlaces(f.candidates,f.area,f.query,context.checkingSummary!,context.privateSpending,context.memories,context.visitHistory,context.participation,context.travel);assert.equal(result.verified.length,2);assert.deepEqual(result.verified[0].travelBalance,['demo:b-balanced']);
    const mine=(await guests.readOwn(made.token,people[0].edit));await guests.edit(made.token,people[0].edit,{revision:mine.revision,payload:{...people[0].payload,answers:[{...people[0].payload.answers[0],amount:11.31}]}});await assert.rejects(places.context(owner,saved.id,request as Parameters<typeof places.context>[2]));await review();await saveSetup();context=await places.context(owner,saved.id,request as Parameters<typeof places.context>[2]);const blocked=evaluatePlaces(f.candidates,f.area,f.query,context.checkingSummary!,context.privateSpending,context.memories,context.visitHistory,context.participation,context.travel);assert.equal(blocked.verified.length,0);assert.ok(blocked.excluded.every(r=>!r.travelBalance));assert.ok(!JSON.stringify(blocked).includes('11.31'));assert.ok(!JSON.stringify(blocked).includes('0.17'));assert.equal(providerCalls,1);
  });
  await t.test('history changing during an in-flight discovery request rejects the stale response without retry',async()=>{
    duringSearch=async()=>{const row=(await outings.get(owner,recorded[0]))!;await travel.history(owner,recorded[0],{revision:row.revision,requestId:id(),history:null});};
    const response=await fetch(base+'/places/search',{method:'POST',headers:{Authorization:'Bearer synthetic-owner-token','Content-Type':'application/json'},body:JSON.stringify(request)});assert.equal(response.status,409);assert.equal(providerCalls,2);assert.ok(!(await response.text()).includes('aliasId'));duringSearch=undefined;
  });
  await t.test('actual correction clears travel evidence; stale revisions/scope/group IDs and direct roles cannot mutate it',async()=>{
    const r=(await outings.get(owner,recorded[0]))!;await assert.rejects(travel.history(other,recorded[0],{revision:r.revision,requestId:id(),history:null}));await assert.rejects(travel.history(owner,recorded[0],{revision:r.revision-1,requestId:id(),history:null}));
    await outings.editActual(owner,recorded[0],{requestId:id(),revision:r.revision,actual:{...r.actual,meetingPoint:'Corrected synthetic location'},sameListing:false,confirmedAttendees:[]});assert.equal((await travel.get(owner,saved.id)).outings.find(o=>o.sessionId===recorded[0])!.history,null);
    const d=await travel.get(owner,saved.id);await assert.rejects(travel.save(owner,saved.id,{revision:d.revision,requestId:id(),sessionRevision:1,scopeKey:'0'.repeat(64),setup}));
    await assert.rejects(db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE anon');await tx.$queryRawUnsafe('SELECT "travelReview" FROM fuzl.fuzl_outings');}));
    const updated=await accounts.updateSession(owner,saved.id,group.id,1,{...payload,title:'New revision'});assert.equal(updated.revision,2);assert.equal((await travel.get(owner,saved.id)).current,false);
  });
});
