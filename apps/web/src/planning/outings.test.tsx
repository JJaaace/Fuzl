import assert from 'node:assert/strict';
import { after,test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { answerRecordedPlan, planQuestionRequestSchema } from '@fuzl/planning';
import type { PlanningSummary } from '@fuzl/planning';
import { examples } from './examples';
import { ShortlistProvider } from '../ballots/context';
import { DiscoveryProvider } from './DiscoveryContext';
GlobalRegistrator.register({url:'http://127.0.0.1:5173',settings:{enableJavaScriptEvaluation:false,disableJavaScriptFileLoading:true,enableCSSFileLoading:false,enableImageFileLoading:false}});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const {act,useState}=await import('react'),{createRoot}=await import('react-dom/client'),{default:SummaryReview}=await import('./SummaryReview');
after(async()=>{await GlobalRegistrator.unregister();});
const settle=()=>new Promise<void>(r=>setImmediate(r));
async function click(node:Element|null){assert.ok(node);for(let p=node.parentElement;p;p=p.parentElement)if(p instanceof HTMLDetailsElement&&!p.open)assert.ok(p.querySelector('summary')?.contains(node),'Action is reachable');await act(async()=>{(node as HTMLElement).click();await settle();});}
function button(label:string,root:ParentNode=document){const value=[...root.querySelectorAll('button')].find(n=>n.textContent===label);assert.ok(value,label);return value;}
async function enter(input:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));await settle();});}
async function mount(t:TestContext,index=1,sample=true){let replace:(s:PlanningSummary)=>void=()=>{};const requests:string[]=[];t.mock.method(globalThis,'fetch',async(url:string,init:RequestInit)=>{requests.push(url);const request=planQuestionRequestSchema.parse(JSON.parse(String(init.body)));return Response.json(answerRecordedPlan(request.summary,request.question,request.participantId));});
  function Fixture(){const [summary,setSummary]=useState(structuredClone(examples[index].summary));replace=setSummary;return <ShortlistProvider><DiscoveryProvider summary={summary}><SummaryReview summary={summary} sampleId={examples[index].id} sourceKind={sample?'sample':'ai'} onChange={setSummary}/></DiscoveryProvider></ShortlistProvider>;}
  const container=document.createElement('section');container.className='summary-panel';document.body.append(container);const root=createRoot(container);t.after(async()=>{await act(async()=>root.unmount());container.remove();});await act(async()=>{root.render(<Fixture/>);await settle();});return{replace,requests};
}
for(const index of [0,1,2])test(`sample ${index+1} immediately shows distinct offline ideas, optional facts, uncertainty and a working shortlist`,async t=>{
  const {requests}=await mount(t,index);assert.equal(requests.length,0);const cards=[...document.querySelectorAll('.plan-outings > .outing-grid .outing-card')];assert.ok(cards.length>=2&&cards.length<=3);assert.equal(new Set(cards.map(c=>c.querySelector('h3')!.textContent)).size,cards.length);
  assert.equal(document.querySelector<HTMLDetailsElement>('.group-details')!.open,false);assert.equal(document.querySelector<HTMLDetailsElement>('.plan-details')!.open,false);
  assert.match(cards[0].textContent!,/Sample activity idea/);await click(button('Add to shortlist',cards[0]));assert.match(document.querySelector('.plan-shortlist')!.textContent!,/1\/3/);const name=cards[0].querySelector('h3')!.textContent!;
  await click(button('More general ideas'));assert.ok(document.querySelector('.plan-shortlist')!.textContent!.includes(name));assert.match(document.querySelector('.plan-shortlist')!.textContent!,/1\/3/);assert.equal(requests.length,0);
  if(index===1){assert.match(document.querySelector('.outings-heading')!.textContent!,/Friday evening · tentative/);await click(button('Review the date'));assert.equal((document.querySelector('.fact-form input[type=date]') as HTMLInputElement).value,'');}
  if(index===2){await click(button('Review the conflict'));assert.ok(document.querySelector('.question-card .fact-form'));}
});
test('a corrected firm budget recalculates exclusions without inventing venue or price evidence',async t=>{
  const {replace}=await mount(t,0);const excluded=document.querySelector('.excluded-outings')!;assert.match(excluded.textContent!,/Mini-golf/);assert.equal((button('Add to shortlist',excluded) as HTMLButtonElement).disabled,true);
  const changed=structuredClone(examples[0].summary);for(const f of changed.facts)if(f.kind==='budget')f.amount=30;await act(async()=>{replace(changed);await settle();});assert.equal(document.querySelector('.excluded-outings'),null);assert.equal(document.querySelectorAll('.outing-grid .outing-card').length,3);assert.ok([...document.querySelectorAll('.outing-open')].every(p=>p.textContent?.includes('Still needs checking')));
});
test('Ask Fuzl answers the tentative fixture, opens source excerpts, changes nothing, and reflects an applied correction',async t=>{
  const {replace,requests}=await mount(t);await enter(document.querySelector('#plan-question')!,'When is Sam available?');await click(button('Ask Fuzl'));assert.equal(requests.length,0);assert.match(document.querySelector('.plan-answer')!.textContent!,/Maybe after 7/);await click(button('Source ↗',document.querySelector('.plan-answer')!));assert.equal(document.querySelector<HTMLDetailsElement>('[data-fact-id="b-time"] .supporting-text')!.open,true);assert.equal(document.querySelector('.fact-form'),null);
  const changed=structuredClone(examples[1].summary);const f=changed.facts.find(f=>f.id==='b-time')!;if(f.kind==='schedule')f.description='Maybe after 8; AM/PM unknown';await act(async()=>{replace(changed);await settle();});assert.equal(document.querySelector('.plan-answer'),null);await click(button('Ask Fuzl'));assert.match(document.querySelector('.plan-answer')!.textContent!,/Maybe after 8/);
});
test('imported facts use the same cards and server question contract; late answers do not overwrite an edit',async t=>{
  const {requests,replace}=await mount(t,1,false);assert.equal(requests.length,0);assert.match(document.querySelector('.outing-card')!.textContent!,/General activity idea/);
  let finish:(r:Response)=>void=()=>{};t.mock.method(globalThis,'fetch',async()=>new Promise<Response>(r=>{finish=r;}));await enter(document.querySelector('#plan-question')!,'When is Sam available?');await click(button('Ask Fuzl'));const changed=structuredClone(examples[1].summary);changed.participants[1].name='Sam corrected';await act(async()=>{replace(changed);await settle();});await act(async()=>{finish(Response.json(answerRecordedPlan(examples[1].summary,'When is Sam available?')));await settle();});assert.equal(document.querySelector('.plan-answer'),null);assert.match(document.querySelector('.ask-fuzl [role=alert]')!.textContent!,/plan changed/);
});

test('the Plan cards reuse sourced Places/Events snapshots and invalidate a changed search while preserving shortlisted options',async t=>{
  const {default:Finder}=await import('../places/PlaceFinder');
  const summary=structuredClone(examples[0].summary);let network=0;t.mock.method(globalThis,'fetch',async()=>{network++;throw Error('No provider allowed');});
  const element=document.createElement('section');element.className='summary-panel';document.body.append(element);const root=createRoot(element);t.after(async()=>{await act(async()=>root.unmount());element.remove();});
  await act(async()=>{root.render(<ShortlistProvider><DiscoveryProvider summary={summary}><SummaryReview summary={summary} onChange={()=>{}}/><Finder summary={summary} previewOnly getEditRevision={()=>0}/></DiscoveryProvider></ShortlistProvider>);await settle();});
  const area=[...document.querySelectorAll('label')].find(l=>l.textContent?.startsWith('Search area'))!.querySelector<HTMLInputElement>('input')!;await enter(area,'Columbus, OH');
  await click(button('Show demo results'));assert.match(document.querySelector('.plan-outings .outing-card')!.textContent!,/Demo listing fixture/);
  const card=document.querySelector('.plan-outings .outing-card')!;assert.ok(card.querySelector('a[href]'));await click(button('Add to shortlist',card));const selected=document.querySelector('.plan-shortlist')!.textContent;
  await enter(area,'02108');assert.match(document.querySelector('.plan-outings .source-warning')!.textContent!,/out of date/);assert.equal(document.querySelector('.plan-shortlist')!.textContent,selected);
  await click(button('Events'));const dates=[...document.querySelectorAll<HTMLInputElement>('.event-finder input[type=date]')];assert.equal(dates.length,2);await enter(dates[0],'2026-11-14');await enter(dates[1],'2026-11-15');await click(button('Show demo events'));
  assert.match(document.querySelector('.plan-outings .outing-card')!.textContent!,/Demo listing fixture/);assert.match(document.querySelector('.plan-outings .outing-card a')!.getAttribute('href')!,/event|ticket/);assert.equal(network,0);
});

test('owned checks block unverified private-context fallback, recover explicitly, and keep private totals out of cards',async t=>{
  const {proposePlan}=await import('../../../api/src/extraction/propose');const {planProposalRequestSchema}=await import('@fuzl/planning');
  let calls=0,failed=true;const summary=structuredClone(examples[0].summary),saved={id:crypto.randomUUID(),revision:1};
  t.mock.method(globalThis,'fetch',async(_url:string,init:RequestInit)=>{calls++;if(failed)return Response.json({error:{message:'Synthetic sign-in expired; sign in again.'}},{status:401});const input=planProposalRequestSchema.parse(JSON.parse(String(init.body)));return Response.json(await proposePlan(input,new AbortController().signal,{authorization:'Bearer synthetic-access-token-long'},true,{verify:async()=> 'owner',store:()=>({context:async()=>({version:'one',privateSpending:[{state:'known',amount:11.17,currency:'USD'}]})})}));});
  const container=document.createElement('section');container.className='summary-panel';document.body.append(container);const root=createRoot(container);t.after(async()=>{await act(async()=>root.unmount());container.remove();});await act(async()=>{root.render(<ShortlistProvider><SummaryReview summary={summary} sampleId="straightforward" onChange={()=>{}} proposal={{saved,token:'synthetic-access-token-long'}}/></ShortlistProvider>);await settle();});
  assert.equal(calls,1);assert.match(document.querySelector('.plan-outings [role=alert]')!.textContent!,/expired/);assert.ok([...document.querySelectorAll<HTMLButtonElement>('.outing-copy > button')].every(b=>b.disabled));failed=false;await click(button('Retry checks'));assert.equal(calls,2);assert.ok(!document.querySelector('.plan-outings')!.textContent!.includes('11.17'));assert.match(document.querySelector('.excluded-outings')!.textContent!,/Private spending check/);
});

test('opening saved ballot controls keeps choices made on the Plan page and uses the saved revision on explicit save',async t=>{
  const {default:OrganizerBallot}=await import('../ballots/OrganizerBallot');const {useShortlist,useShortlistDraft}=await import('../ballots/context');
  const option={id:crypto.randomUUID(),kind:'idea' as const,name:'Temporary outing choice',time:null,location:null,cost:{amount:null,currency:null,kind:'unknown' as const,basis:'unknown' as const},links:[],unresolved:['Cost unknown'],sample:true};
  const stored={title:'Stored ballot',options:[{...option,id:crypto.randomUUID(),name:'Older saved idea'}]};const writes:unknown[]=[];
  const request=async(_path:string,method:string,body?:unknown)=>{if(method==='PUT'){writes.push(body);return{content:(body as {content:unknown}).content,revision:5};}return{shortlist:{content:stored,revision:4},ballots:[]};};
  function Fixture(){const [open,setOpen]=useState(false),add=useShortlist()!,draft=useShortlistDraft()!;return <><button onClick={()=>add(()=>option)}>Choose outing</button><button onClick={()=>setOpen(true)}>Open saving controls</button>{open&&<OrganizerBallot content={draft.content} onContent={draft.onContent} changeRevision={draft.changeRevision} onMessage={draft.onMessage} demoRequest={request}/>}</>;}
  const element=document.createElement('section');document.body.append(element);const root=createRoot(element);t.after(async()=>{await act(async()=>root.unmount());element.remove();});await act(async()=>{root.render(<ShortlistProvider><Fixture/></ShortlistProvider>);await settle();});
  await click(button('Choose outing'));await click(button('Open saving controls'));assert.match(document.querySelector('.ballot-organizer')!.textContent!,/Temporary outing choice/);const input=[...document.querySelectorAll('label')].find(l=>l.textContent?.startsWith('Public option name'))!.querySelector<HTMLInputElement>('input')!;assert.equal(input.value,'Temporary outing choice');await click(button('Save shortlist'));assert.equal((writes[0] as {revision:number}).revision,4);
});

test('an imported conversation matching sample wording never inherits synthetic quoted prices or sample labels',async t=>{
  await mount(t,0,false);assert.equal(document.querySelector('.excluded-outings'),null);assert.ok(!document.querySelector('.plan-outings')!.textContent!.includes('Mini-golf · sample quote'));assert.ok([...document.querySelectorAll('.outing-cost')].every(e=>e.textContent==='Cost not known'));assert.match(document.querySelector('.outing-copy .eyebrow')!.textContent!,/General activity idea/);
});
