import assert from 'node:assert/strict';
import {test} from 'node:test';
import {once} from 'node:events';
import {examples,GEMINI_MODEL,analysisResponseSchema,proposedPlanSchema,planningBudget} from '@fuzl/planning';
import type {AnalysisResponse,ProposedPlan} from '@fuzl/planning';
import {makeConversationPlan,plannerInstructions} from './planner.js';
import {createApp} from '../app.js';
const metrics:AnalysisResponse['metrics']={provider:'gemini' as const,model:GEMINI_MODEL,latencyMs:12,inputTokens:20,outputTokens:30,estimatedCostUsd:null};
const request={conversation:examples[0].conversation,referenceDate:'2026-11-10'};
function extracted():AnalysisResponse{return analysisResponseSchema.parse({summary:structuredClone(examples[0].summary),warnings:[],metrics});}
function proposal():ProposedPlan{return proposedPlanSchema.parse({activity:'Bowling',activityType:'A local bowling alley with quiet lanes',date:'2026-11-14',dateLabel:'Saturday',startTime:'19:00',endTime:'20:00',costPerPerson:18,currency:'USD',travelNote:'Actual travel is unknown; verify the stated drive limits.',timingNote:'Proposed, not booked; confirm venue-local time zone.',why:'The estimate is below both stated spending limits and the time is within the supplied window.',backup:'Try a quiet café if lanes are unavailable; check its price and hours.',message:"thinking bowling sat 7, about $18 each — who's in?",questions:['Which venue has space?'],assumptions:['Cost is an estimate, not a listing or booking.']});}

test('planner returns one new, validated proposal without mutating extracted facts, leaking names/quotes, or marking a verified fit',async()=>{
 const source=extracted(),before=structuredClone(source);let calls=0;
 const result=await makeConversationPlan(request,new AbortController().signal,async()=>source,{generate:async context=>{calls++;const data=JSON.stringify(context);assert.ok(!/\b(?:Alex|Sam)\b/.test(data)&&!data.includes('nothing is booked'));assert.match(data,/"ceiling":20/);return{result:proposal(),metrics};}});
 assert.equal(calls,1);assert.deepEqual(source,before);assert.deepEqual(result.summary,before.summary);assert.equal(result.proposal?.origin,'ai');assert.equal(result.proposal?.fit,'needs-checking');assert.equal(result.proposal?.costPerPerson,18);assert.equal(result.metrics.inputTokens,40);assert.equal(result.metrics.estimatedCostUsd,null);
});
test('over-budget, incompatible time/date, malformed/extra fields and invented currencies fail rather than losing claims silently',async()=>{
 for(const override of [{costPerPerson:25},{startTime:'17:00'},{date:'2026-11-15'},{currency:'EUR'}])await assert.rejects(()=>makeConversationPlan(request,new AbortController().signal,async()=>extracted(),{generate:async()=>({result:{...proposal(),...override},metrics})}),/constraint|currency/);
 assert.equal(proposedPlanSchema.safeParse({...proposal(),confirmed:true}).success,false);assert.equal(proposedPlanSchema.safeParse({...proposal(),date:'2026-02-31'}).success,false);
});
test('zero is a real cap, unknown budgets/currencies remain unknown, tentative facts stay tentative and corrections stay intact',async()=>{
 const zero=extracted();const budget=zero.summary.facts.find(f=>f.kind==='budget');assert.ok(budget?.kind==='budget');budget.amount=0;
 assert.equal(planningBudget(zero.summary).ceiling,0);await assert.rejects(()=>makeConversationPlan(request,new AbortController().signal,async()=>zero,{generate:async()=>({result:proposal(),metrics})}),/constraint/);
 const tentativeSummary=structuredClone(examples[1].summary);tentativeSummary.facts=tentativeSummary.facts.filter(f=>f.sourceIds.length>0);const tentative=analysisResponseSchema.parse({summary:tentativeSummary,warnings:[],metrics});assert.equal(planningBudget(tentative.summary).currency,null);const before=structuredClone(tentative.summary);
 const result=await makeConversationPlan({...request,conversation:examples[1].conversation,referenceDate:null},new AbortController().signal,async()=>tentative,{now:()=>new Date('2026-11-24'),generate:async context=>{assert.match(JSON.stringify(context),/referenceIsAssumption/);return{result:{...proposal(),currency:null,date:null,dateLabel:'Friday (suggested)'},metrics};}});
 assert.deepEqual(result.summary,before);assert.ok(result.proposal!.questions.length>=3);assert.equal(result.summary.facts.find(f=>f.id==='b-date')?.kind,'schedule');
});
test('actual Gemini adapter uses structured proposal schema, keeps embedded instructions as data, and quota stops after one request',async t=>{
 for(const key of ['AI_PROVIDER','AI_ENABLED','GEMINI_API_KEY']){const previous=process.env[key];process.env[key]=key==='AI_PROVIDER'?'gemini':key==='AI_ENABLED'?'true':'test-only-placeholder';t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});}
 let calls=0,quota=false;t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{calls++;assert.ok(!String(input).includes('test-only-placeholder'));const body=JSON.parse(String(init?.body));assert.equal(body.systemInstruction.parts[0].text,plannerInstructions);assert.equal(body.generationConfig.responseJsonSchema.type,'object');assert.ok(!String(init?.body).includes('Alex:'));if(quota)return Response.json({error:{code:429,status:'RESOURCE_EXHAUSTED',message:'quota'}},{status:429});return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(proposal())}]}}]});});
 await makeConversationPlan(request,new AbortController().signal,async()=>extracted());assert.equal(calls,1);quota=true;await assert.rejects(()=>makeConversationPlan(request,new AbortController().signal,async()=>extracted()),/quota/i);assert.equal(calls,2);
});
test('new route preserves LAN access restriction, validates a complete plan, and rejects recap-only responses',async t=>{
 const complete={...extracted(),proposal:{...proposal(),origin:'ai' as const,fit:'needs-checking' as const,checks:['Unresearched proposal.']}};let calls=0;let recap=false;
 const app=createApp({checkConfiguration:()=>{},makePlan:async()=>{calls++;return recap?extracted():complete;}});const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const address=server.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}/api/make-plan`;
 const send=(origin:string)=>fetch(url,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(request)});
 assert.equal((await send('http://192.168.1.105:5174')).status,403);assert.equal(calls,0);const response=await send('http://127.0.0.1:5173');assert.equal(response.status,200);const payload:unknown=await response.json();assert.ok(payload&&typeof payload==='object'&&'proposal' in payload);recap=true;assert.equal((await send('http://127.0.0.1:5173')).status,502);assert.equal(calls,2);
});
