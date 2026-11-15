import assert from 'node:assert/strict';
import { test } from 'node:test';
import { travelFixture, evaluatePlaces, evaluateEvents, summaryForScope, workKey, travelSetupSchema, travelHistorySchema, travelDashboardSchema, shortlistPlace, balanceTravel, demoEvents } from '@fuzl/planning';
import { travelRanking } from './ranking';
import { preferredPlaces } from '../discovery/ranking';
const evaluated = (f=travelFixture()) => evaluatePlaces(f.candidates,f.area,f.query,summaryForScope(f.summary,f.scope),[],[],undefined,f.scope,f.travel);
test('travel tie-breaker is off by default; full group reverses two fits, subset returns usual order, firm budget remains excluded, public snapshots omit private evidence',()=>{
  const f=travelFixture(), result={...evaluated(f),mode:'demo' as const,retrievedAt:new Date(f.travel.now).toISOString()};
  assert.deepEqual(result.verified.map(r=>r.candidate.id),['a-usual','b-balanced']);
  assert.deepEqual(preferredPlaces(result,'balanced').result.verified.map(r=>r.candidate.id),['a-usual','b-balanced']);
  const enabled=preferredPlaces(result,'balanced',true);assert.deepEqual(enabled.result.verified.map(r=>r.candidate.id),['b-balanced','a-usual']);assert.match(enabled.notice,/Helps balance travel/);
  assert.equal(enabled.result.excluded[0].candidate.id,'c-budget');assert.equal(enabled.result.promising[0].candidate.id,'d-unknown');
  const sub=evaluated(travelFixture(true));assert.deepEqual(travelRanking(sub.ranked!,true,'balanced').ordered.slice(0,2).map(r=>r.candidate.id),['a-usual','b-balanced']);
  const publicOption=shortlistPlace(result.verified[0],crypto.randomUUID());assert.ok(!JSON.stringify(publicOption).includes('travelBalance'));assert.ok(!JSON.stringify(result).includes('aliasId'));assert.ok(!JSON.stringify(result).includes('synthetic-private-minutes'));
});
test('missing, corrected, deleted, old, other-group or mismatched-mode history cannot change ordinary order; zero is known, not missing',()=>{
  for(const variant of ['other-group','corrected','deleted','missing'] as const){const f=travelFixture(false,variant),r=evaluated(f);assert.equal(travelRanking(r.ranked!,true,'balanced').moved.size,0,variant);if(variant==='missing')assert.equal(r.verified.length,0);}
  for(const edit of ['old','mode','attendance','mapping','unchecked','address','window','stale-estimate'] as const){const f=travelFixture();if(edit==='old')f.travel.outings.forEach(o=>o.date='2025-01-01');if(edit==='mode')f.travel.outings[0].history.mode='driving';if(edit==='attendance')f.travel.outings[0].history.attendees.pop();if(edit==='mapping')f.travel.setup.mappings=[];if(edit==='unchecked')f.travel.scope.reviewed=false;if(edit==='address')f.travel.setup.estimates[1].address='Different location';if(edit==='window')f.travel.setup.estimates[1].window={...f.window,start:'20:00'};if(edit==='stale-estimate')f.travel.setup.estimates.forEach(e=>e.checkedOn='2026-10-01');const r=evaluated(f);assert.equal(travelRanking(r.ranked!,true,'balanced').moved.size,0,edit);}
  const f=travelFixture();f.travel.setup.estimates[1].minutes.forEach(m=>m.minutes=0);assert.ok(evaluated(f).ranked!.find(r=>r.candidate.id==='b-balanced')!.travelBalance?.length);
});
test('current per-person estimates preserve strict firm and speaker/group limits, even with another estimate missing',()=>{
  const f=travelFixture();const e=f.travel.setup.estimates[1];e.minutes[0].minutes=80;e.minutes[1].minutes=null;assert.equal(evaluated(f).ranked!.find(r=>r.candidate.id==='b-balanced')!.status,'does-not-fit');
  e.minutes[0].minutes=60;const fact=f.summary.facts.find(x=>x.kind==='travel'&&x.subject.kind==='participant'&&x.subject.participantId==='person-1')!;assert.equal(fact.kind,'travel');if(fact.kind!=='travel')return;fact.comparison='under';fact.mode='walk';f.summary.speakers=[{id:'speaker-one',label:'Synthetic speaker',participantId:'person-1'}];fact.subject={kind:'speaker',speakerId:'speaker-one'};assert.equal(evaluated(f).ranked!.find(r=>r.candidate.id==='b-balanced')!.status,'does-not-fit');
});
test('adjacent bound preserves fit category, approved memory, activity and discovery preferences; worsening the highest-burden attendee never earns a hint',()=>{
  const f=travelFixture(),r=evaluated(f).ranked!,a=r[0],b=r[1];
  assert.equal(travelRanking([a,{...b,memory:{boost:2,reason:'Synthetic approved favorite'}}],true,'balanced').moved.size,0);
  assert.equal(travelRanking([{...a,discovery:{visit:'recorded',favorite:true,reason:'approved'}},{...b,discovery:{visit:'no-recorded-visit',favorite:false,reason:'none'}}],true,'familiar').moved.size,0);
  assert.equal(travelRanking([a,{...b,ranking:['Different explicit activity','same'],travelBalance:[workKey(a.candidate)]}],true,'balanced').moved.size,0);
  f.travel.setup.estimates[1].minutes[2].minutes=45;assert.equal(evaluated(f).ranked![1].travelBalance?.length,0);
  const equal=balanceTravel([a,b],undefined,x=>({key:workKey(x.candidate),address:x.candidate.address,window:f.window}));assert.deepEqual(equal,[a,b]);
});
test('contracts reject guessed attendance, mixed basis, bad minutes, duplicate/ambiguous mappings, invalid dates and credential-bearing sources',()=>{
  const f=travelFixture();assert.equal(travelSetupSchema.safeParse(f.travel.setup).success,true);assert.equal(travelHistorySchema.safeParse(f.travel.outings[0].history).success,true);
  for(const minutes of [-1,361,1.5,'12',undefined]){const bad=structuredClone(f.travel.setup);bad.estimates[0].minutes[0].minutes=minutes as number;assert.equal(travelSetupSchema.safeParse(bad).success,false);}
  assert.equal(travelHistorySchema.safeParse({...f.travel.outings[0].history,basis:'round-trip'}).success,false);assert.equal(travelHistorySchema.safeParse({...f.travel.outings[0].history,attendees:[{aliasId:f.travel.setup.mappings[0].aliasId,attended:false,minutes:1}]}).success,false);
  assert.equal(travelSetupSchema.safeParse({...f.travel.setup,mappings:[f.travel.setup.mappings[0],f.travel.setup.mappings[0]]}).success,false);
  assert.equal(travelSetupSchema.safeParse({...f.travel.setup,estimates:[{...f.travel.setup.estimates[0],sourceUrl:'https://example.com/?token=private'}]}).success,false);
  assert.equal(travelDashboardSchema.safeParse({}).success,false);
});
test('Events share travel gates and safe server hints without upgrading unknown end times, tickets or firm affordability',()=>{
  const f=travelFixture(),events=demoEvents({area:f.query.area,radiusKm:f.query.radiusKm,from:f.window.date,to:f.window.date},new Date(f.travel.now).toISOString());assert.ok('events'in events);
  const r=evaluateEvents(events.events,events.area,{area:f.query.area,radiusKm:f.query.radiusKm,from:f.window.date,to:f.window.date},summaryForScope(f.summary,f.scope),[],[],undefined,f.scope,f.travel);
  assert.ok(r.ranked!.every(e=>!e.travelBalance || e.status==='fits'));assert.ok(!JSON.stringify(r).includes('aliasId'));assert.ok(r.ranked!.some(e=>e.status!=='fits'));
});
test('two fully checked events use the same private one-way comparison; public event options omit travel hints',async()=>{
  const {shortlistEvent}=await import('@fuzl/planning');const f=travelFixture();const found=demoEvents({area:f.query.area,radiusKm:5,from:f.window.date,to:f.window.date},new Date(f.travel.now).toISOString());assert.ok('events'in found);const template=found.events[0];
  const events=f.candidates.slice(0,2).map(c=>({...template,id:c.id,title:c.name,sourceUrl:c.sourceUrl,venue:{...template.venue,address:c.address,lat:c.lat,lon:c.lon},schedule:{...template.schedule,date:f.window.date,time:f.window.start,endDate:f.window.date,endTime:f.window.end,timeZone:f.window.timeZone},visit:c.visit}));
  const r=evaluateEvents(events,f.area,{area:f.query.area,radiusKm:5,from:f.window.date,to:f.window.date},summaryForScope(f.summary,f.scope),[],[],undefined,f.scope,f.travel);assert.equal(r.verified.length,2);const balanced=travelRanking(r.ranked!,true,'balanced');assert.equal(balanced.ordered[0].event.id,'b-balanced');const option=shortlistEvent(r.verified[0],crypto.randomUUID());assert.ok(!JSON.stringify(option).includes('travelBalance'));assert.ok(!JSON.stringify(option).includes('synthetic-private-minutes'));
});
