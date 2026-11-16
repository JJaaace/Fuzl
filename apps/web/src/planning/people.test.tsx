import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { peopleFixture, planProposalRequestSchema, personFacts } from '@fuzl/planning';
import type { PlanningSummary, PlanProposalRequest } from '@fuzl/planning';
import { renderToStaticMarkup } from 'react-dom/server';
import { proposePlan } from '../../../api/src/extraction/propose.js';
import { examples } from './examples';
GlobalRegistrator.register({url:'http://127.0.0.1:5173',settings:{enableJavaScriptEvaluation:false,disableJavaScriptFileLoading:true,enableCSSFileLoading:false,enableImageFileLoading:false}});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const {act,useState}=await import('react');
const {createRoot}=await import('react-dom/client');
const {default:SummaryReview}=await import('./SummaryReview');
after(async()=>{await GlobalRegistrator.unregister();});
const settle=()=>new Promise<void>(r=>setImmediate(r));
async function click(element:Element|null){assert.ok(element);await act(async()=>{(element as HTMLElement).click();await settle();});}
function button(text:string,root:ParentNode=document){const found=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text);assert.ok(found,text);return found;}
async function enter(element:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));await settle();});}
async function mount(t:TestContext,summary=peopleFixture(2).summary){
  const requests:PlanProposalRequest[]=[];
  t.mock.method(globalThis,'fetch',async(url:string,options:RequestInit)=>{
    assert.ok(['/api/check-plan','/api/suggest-plan'].includes(url));const body=planProposalRequestSchema.parse(JSON.parse(String(options.body)));requests.push(body);
    return Response.json(await proposePlan(body,new AbortController().signal,{},url==='/api/check-plan',{choose:async data=>({id:data.candidates[0].id,metrics:null})}));
  });
  let replace:((value:PlanningSummary)=>void)|undefined;
  function Fixture(){const [value,setValue]=useState(summary);replace=setValue;return <SummaryReview summary={value} onChange={setValue} proposal={{initialManual:peopleFixture(2).manual}}/>;}
  const container=document.createElement('section');container.className='summary-panel';document.body.append(container);const root=createRoot(container);
  t.after(async()=>{await act(async()=>root.unmount());container.remove();});
  await act(async()=>{root.render(<Fixture/>);await settle();});return{requests,replace:(value:PlanningSummary)=>replace!(value)};
}
async function editSam(){const person=document.querySelector('[data-person-id="p1"]')!;await click(person.querySelector('.person-edit summary'));await click(button('Edit budget per person',person));for(let i=0;i<10&&!document.querySelector('.fact-form');i++)await act(settle);return person;}

test('bowling People cards show fixture limits, flexible quiet preference, stable attribution and reachable sources',async t=>{
  await mount(t,examples[0].summary);
  const alex=document.querySelector('[data-person-id="p0"]')!,sam=document.querySelector('[data-person-id="p1"]')!;
  assert.match(alex.textContent!,/\$25\/person/);assert.match(alex.textContent!,/20 min max drive/);assert.match(alex.textContent!,/Somewhere quietFlexible/);
  assert.match(sam.textContent!,/\$20\/person/);assert.match(sam.textContent!,/20 min max drive/);
  await click(alex.querySelector('.supporting-text summary'));assert.match(alex.querySelector('blockquote')!.textContent!,/Alex:/);
  assert.equal(document.querySelector('.plan-overview')!.nextElementSibling?.className,'people-section');
  assert.equal(document.querySelector<HTMLDetailsElement>('.plan-details')!.open,false);assert.equal(document.querySelectorAll('.plan-overview button.primary').length,1);
});

test('applying Sam’s budget updates the same card, highlights/focuses its row and changes the next server check',async t=>{
  const {requests}=await mount(t);assert.equal(requests.length,0,'no automatic AI or checking call');
  await click(button('Check fit without AI'));assert.match(document.querySelector('.plan-proposal-result')!.textContent!,/Excluded by firm checks/);
  const sam=await editSam();const form=document.querySelector<HTMLFormElement>('[data-fact-id="budget-1"] .fact-form')!;assert.ok(form);
  const amount=form.querySelector<HTMLInputElement>('input[inputmode=decimal]')!;await enter(amount,'-2');await click(button('Apply changes',form));assert.ok(form.querySelector('[role=alert]'));assert.match(sam.textContent!,/\$20\/person/);
  await enter(amount,'30');await click(button('Apply changes',form));
  for(let i=0;i<15&&document.activeElement?.getAttribute('data-person-fact')!=='budget-1';i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
  assert.equal(document.querySelector('[data-person-id="p1"]'),sam);assert.match(sam.textContent!,/\$30\/person/);assert.ok(sam.querySelector('[data-person-fact="budget-1"] .row-update-flash'));assert.equal(document.activeElement?.getAttribute('data-person-fact'),'budget-1');
  assert.match(document.querySelector('.plan-suggestions .source-warning')!.textContent!,/out of date/);
  assert.match(sam.querySelector('blockquote')!.textContent!,/USD 20/,'original supporting evidence was retained');
  await click(button('Check fit without AI'));assert.equal(requests.length,2);assert.equal(requests[1].summary.facts.find(f=>f.kind==='budget'&&f.id==='budget-1')?.kind,'budget');
  assert.equal(personFacts(requests[1].summary,'p1').find(f=>f.kind==='budget')?.amount,30);
  assert.match(document.querySelector('.plan-proposal-result')!.textContent!,/Still needs checking/);assert.doesNotMatch(document.querySelector('.plan-proposal-result')!.textContent!,/Excluded by firm checks/);
  await click(button('Suggest a plan'));assert.equal(requests.length,3);assert.match(document.querySelector('.plan-proposal-result')!.textContent!,/Gemini proposal · unreviewed/,'mock selection, not a live Gemini result');
});

test('a pending proposal cannot overwrite changed facts; a duplicate click makes only one request',async t=>{
  const {replace}=await mount(t);let calls=0;let finish:((r:Response)=>void)|undefined;
  const original=peopleFixture(2);for(const f of original.summary.facts)if(f.kind==='budget')f.amount=30;
  await act(async()=>{replace(original.summary);await settle();});
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Promise<Response>(r=>{finish=r;});});
  await click(button('Suggest a plan'));await click(button('Preparing…'));assert.equal(calls,1);
  const changed=structuredClone(original.summary);changed.participants[1].name='Sam corrected';await act(async()=>{replace(changed);await settle();});
  const response=await proposePlan({...original,expectedProvider:'gemini'},new AbortController().signal,{},false,{choose:async body=>({id:body.candidates[0].id,metrics:null})});
  await act(async()=>{finish!(Response.json(response));await settle();});assert.match(document.querySelector('.plan-suggestions [role=alert]')!.textContent!,/stale suggestion was discarded/);assert.equal(document.querySelector('.plan-proposal-result'),null);assert.match(document.querySelector('[data-person-id="p1"]')!.textContent!,/Sam corrected/);
});

test('unapplied edits block new proposals; cancellation ignores a late response and malformed replies stay recoverable',async t=>{
  const {requests}=await mount(t);await editSam();await click(button('Suggest a plan'));assert.equal(requests.length,0);assert.match(document.querySelector('.plan-suggestions [role=alert]')!.textContent!,/Apply or cancel/);
  await click(button('Cancel',document.querySelector('.fact-form')!));let finish:((r:Response)=>void)|undefined;
  t.mock.method(globalThis,'fetch',async()=>new Promise<Response>(r=>{finish=r;}));await click(button('Suggest a plan'));await click(button('Cancel suggestion'));
  await act(async()=>{finish!(Response.json({invented:true}));await settle();});assert.equal(document.querySelector('.plan-proposal-result'),null);assert.match(document.querySelector('.plan-suggestions [role=alert]')!.textContent!,/Cancelled locally/);
  t.mock.method(globalThis,'fetch',async()=>Response.json({invented:true}));await click(button('Suggest a plan'));assert.match(document.querySelector('.plan-suggestions [role=alert]')!.textContent!,/invalid/);assert.equal(button('Suggest a plan').disabled,false);
});

test('six-person, duplicate-name, unmapped, unknown and non-USD facts keep their identities and labels (content, not viewport)',()=>{
  const fixture=peopleFixture(6).summary;fixture.participants[1].name='Alex';fixture.participants[2].name=null;
  for(const f of fixture.facts)if(f.kind==='budget'){if(f.id==='budget-0')f.amount=0;if(f.id==='budget-1')f.amount=null;if(f.id==='budget-2')f.currency='EUR';}
  fixture.speakers[3].participantId=null;fixture.facts[9].subject={kind:'speaker',speakerId:'s3'};
  const html=renderToStaticMarkup(<SummaryReview summary={fixture} onChange={()=>{}}/>);
  assert.equal((html.match(/class="person-card"/g)||[]).length,6);for(const text of ['$0/person','Amount unknown · USD','EUR 25/person','Participant 1','Participant 2','Name unknown','Unassigned details'])assert.ok(html.includes(text),text);
  assert.ok(html.includes('data-person-id="p1"'));assert.ok(html.includes('Edit attribution &amp; fact'));
});
