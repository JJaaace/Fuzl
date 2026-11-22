import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { peopleFixture, planProposalRequestSchema, personFacts } from '@fuzl/planning';
import type { PlanningSummary, PlanProposalRequest } from '@fuzl/planning';
import { renderToStaticMarkup } from 'react-dom/server';
import { proposePlan } from '../../../api/src/extraction/propose.js';
import { examples } from './examples';
import type { ProposalContext } from './PlanSuggestions';
GlobalRegistrator.register({url:'http://127.0.0.1:5173',settings:{enableJavaScriptEvaluation:false,disableJavaScriptFileLoading:true,enableCSSFileLoading:false,enableImageFileLoading:false}});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const {act,useState}=await import('react');
const {createRoot}=await import('react-dom/client');
const {default:SummaryReview}=await import('./SummaryReview');
after(async()=>{await GlobalRegistrator.unregister();});
const settle=()=>new Promise<void>(r=>setImmediate(r));
async function click(element:Element|null){assert.ok(element);for(let parent=element.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS'&&!(parent as HTMLDetailsElement).open)assert.ok(parent.querySelector('summary')?.contains(element),'action must be visible');await act(async()=>{(element as HTMLElement).click();await settle();});}
function button(text:string,root:ParentNode=document){const found=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text);assert.ok(found,text);return found;}
async function enter(element:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));await settle();});}
async function mount(t:TestContext,summary=peopleFixture(2).summary,context:ProposalContext={}){
  const requests:PlanProposalRequest[]=[];
  t.mock.method(globalThis,'fetch',async(url:string,options:RequestInit)=>{
    assert.ok(['/api/check-plan','/api/suggest-plan'].includes(url));const body=planProposalRequestSchema.parse(JSON.parse(String(options.body)));requests.push(body);
    return Response.json(await proposePlan(body,new AbortController().signal,{},url==='/api/check-plan',{choose:async data=>({id:data.candidates[0].id,metrics:null})}));
  });
  let replace:((value:PlanningSummary)=>void)|undefined;
  function Fixture(){const [value,setValue]=useState(summary);replace=setValue;return <SummaryReview summary={value} onChange={setValue} proposal={{initialManual:peopleFixture(2).manual,...context}}/>;}
  const container=document.createElement('section');container.className='summary-panel';document.body.append(container);const root=createRoot(container);
  t.after(async()=>{await act(async()=>root.unmount());container.remove();});
  await act(async()=>{root.render(<Fixture/>);await settle();});return{requests,replace:(value:PlanningSummary)=>replace!(value)};
}
async function planningTools(){const details=document.querySelector<HTMLDetailsElement>('.planning-tools')!;if(!details.open)await click(details.querySelector('summary'));}
async function groupDetails(){const group=document.querySelector<HTMLDetailsElement>('.group-details')!;if(!group.open)await click(group.querySelector('summary'));}
async function editSam(){await groupDetails();const person=document.querySelector('[data-person-id="p1"]')!;await click(person.querySelector('.person-edit summary'));await click(button('Edit budget per person',person));for(let i=0;i<10&&!document.querySelector('.fact-form');i++)await act(settle);return person;}

test('bowling People cards show fixture limits, flexible quiet preference, stable attribution and reachable sources',async t=>{
  await mount(t,examples[0].summary);await groupDetails();
  const alex=document.querySelector('[data-person-id="p0"]')!,sam=document.querySelector('[data-person-id="p1"]')!;
  assert.match(alex.textContent!,/\$25\/person/);assert.match(alex.textContent!,/20 min max drive/);assert.match(alex.textContent!,/Somewhere quietFlexible/);
  assert.match(sam.textContent!,/\$20\/person/);assert.match(sam.textContent!,/20 min max drive/);
  await click(alex.querySelector('.person-more > summary'));await click(alex.querySelector('.supporting-text summary'));assert.match(alex.querySelector('blockquote')!.textContent!,/Alex:/);
  assert.equal(document.querySelector('.group-details > .people-section')?.className,'people-section');
  assert.equal(document.querySelector<HTMLDetailsElement>('.plan-details')!.open,false);assert.equal(document.querySelectorAll('.plan-outings .outing-grid button.primary').length,3);
});

test('applying Sam’s budget updates the same card, highlights/focuses its row and changes the next server check',async t=>{
  const {requests}=await mount(t);assert.equal(requests.length,0,'no automatic AI or checking call');
  await planningTools();await click(button('Check fit without AI'));assert.match(document.querySelector('.plan-proposal-result')!.textContent!,/Excluded by firm checks/);
  const sam=await editSam();const form=document.querySelector<HTMLFormElement>('[data-fact-id="budget-1"] .fact-form')!;assert.ok(form);
  const amount=form.querySelector<HTMLInputElement>('input[inputmode=decimal]')!;await enter(amount,'-2');await click(button('Apply changes',form));assert.ok(form.querySelector('[role=alert]'));assert.match(sam.textContent!,/\$20\/person/);
  await enter(amount,'30');await click(button('Apply changes',form));
  for(let i=0;i<15&&document.activeElement?.getAttribute('data-person-fact')!=='budget-1';i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
  assert.equal(document.querySelector('[data-person-id="p1"]'),sam);assert.match(sam.textContent!,/\$30\/person/);assert.ok(sam.querySelector('[data-person-fact="budget-1"] .row-update-flash'));assert.equal(document.activeElement?.getAttribute('data-person-fact'),'budget-1');
  assert.match(document.querySelector('.plan-suggestions .source-warning')!.textContent!,/out of date/);
  assert.match(sam.querySelector('blockquote')!.textContent!,/USD 20/,'original supporting evidence was retained');
  await planningTools();await click(button('Check fit without AI'));assert.equal(requests.length,2);assert.equal(requests[1].summary.facts.find(f=>f.kind==='budget'&&f.id==='budget-1')?.kind,'budget');
  assert.equal(personFacts(requests[1].summary,'p1').find(f=>f.kind==='budget')?.amount,30);
  assert.match(document.querySelector('.plan-proposal-result')!.textContent!,/Still needs checking/);assert.doesNotMatch(document.querySelector('.plan-proposal-result')!.textContent!,/Excluded by firm checks/);
  await click(button('Suggest a plan'));assert.equal(requests.length,3);assert.match(document.querySelector('.plan-proposal-result')!.textContent!,/Gemini proposal · unreviewed/,'mock selection, not a live Gemini result');
});

test('a pending proposal cannot overwrite changed facts; a duplicate click makes only one request',async t=>{
  const {replace}=await mount(t);let calls=0;let finish:((r:Response)=>void)|undefined;
  const original=peopleFixture(2);for(const f of original.summary.facts)if(f.kind==='budget')f.amount=30;
  await act(async()=>{replace(original.summary);await settle();});
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Promise<Response>(r=>{finish=r;});});
  await planningTools();await click(button('Suggest a plan'));await click(button('Preparing…'));assert.equal(calls,1);
  const changed=structuredClone(original.summary);changed.participants[1].name='Sam corrected';await act(async()=>{replace(changed);await settle();});
  const response=await proposePlan({...original,expectedProvider:'gemini'},new AbortController().signal,{},false,{choose:async body=>({id:body.candidates[0].id,metrics:null})});
  await act(async()=>{finish!(Response.json(response));await settle();});assert.match(document.querySelector('.plan-suggestions [role=alert]')!.textContent!,/stale suggestion was discarded/);assert.equal(document.querySelector('.plan-proposal-result'),null);assert.match(document.querySelector('[data-person-id="p1"]')!.textContent!,/Sam corrected/);
});

test('unapplied edits block new proposals; cancellation ignores a late response and malformed replies stay recoverable',async t=>{
  const {requests}=await mount(t);await editSam();await planningTools();await click(button('Suggest a plan'));assert.equal(requests.length,0);assert.match(document.querySelector('.plan-suggestions [role=alert]')!.textContent!,/Apply or cancel/);
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

test('Friday compact cards preserve ambiguity/currency while general proposals keep dates unknown',async t=>{
  const {requests}=await mount(t,examples[1].summary);const sam=document.querySelector('[data-person-id="p1"]')!;
  assert.equal(sam.querySelector('[data-person-fact="b-time"] .person-row-value')?.textContent,'Maybe after 7 · AM/PM unclear');
  assert.equal(sam.querySelector('[data-person-fact="b-sbudget"] .person-row-value')?.textContent,'20/person · confirm currency');
  assert.ok(sam.querySelectorAll('[data-person-fact]').length<=3);
  assert.equal(document.querySelector<HTMLDetailsElement>('.person-more')!.open,false);
  await planningTools();assert.equal(button('Suggest a plan').disabled,false);assert.match(document.querySelector('.proposal-prerequisite')!.textContent!,/exact date and time/);
  assert.equal(button('Check fit without AI').disabled,false);await click(button('Check fit without AI'));assert.equal(requests.length,1);
  assert.match(document.querySelector('.plan-proposal-result')!.textContent!,/Choose an exact outing date and time window/);
});

test('LAN preview explains the local requirement before a click without losing sample edits or calling the provider',async t=>{
  const {localActionsAvailable}=await import('./localActions');
  assert.equal(localActionsAvailable('http://127.0.0.1:5173'),true);assert.equal(localActionsAvailable('http://localhost:5173'),true);
  for(const origin of ['http://192.168.1.105:5174','https://example.com','http://127.0.0.1.evil:5173'])assert.equal(localActionsAvailable(origin),false);
  t.mock.getter(window.location,'origin',()=> 'http://192.168.1.105:5174');
  const {requests}=await mount(t);await planningTools();
  assert.match(document.querySelector('.local-suggestions-notice')!.textContent!,/To use AI suggestions, open Fuzl on the Mac/);
  assert.equal(document.querySelector('.local-suggestions-notice a')?.getAttribute('href'),'http://127.0.0.1:5173');
  assert.equal(button('Suggest a plan').disabled,true);assert.equal(requests.length,0);await editSam();assert.ok(document.querySelector('.fact-form'));
});

test('a local API failure preserves the applied facts and its safe reference inside Planning tools',async t=>{
  await mount(t);const before=document.querySelector('[data-person-id="p1"]')!.textContent;const ref='359e4249-0bbe-4703-bb09-75bac64b6d77';
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:{message:'Synthetic quota error; retry deliberately.',reference:ref}},{status:429}));
  await planningTools();await click(button('Suggest a plan'));assert.match(document.querySelector('.planning-tools [role=alert]')!.textContent!,new RegExp(ref));assert.equal(document.querySelector('[data-person-id="p1"]')!.textContent,before);assert.equal(button('Suggest a plan').disabled,false);
});

test('saved work defers date readiness to the server’s reviewed attendee projection, rather than blocking on the full group',async t=>{
  await mount(t,examples[1].summary,{saved:{id:'064ed3a2-632b-43ed-817e-b8de359f94b4',revision:1},token:'synthetic-token'});await planningTools();assert.equal(button('Suggest a plan').disabled,false,'server must evaluate the current owned scope');
});

test('applied-row feedback ends without removing the corrected value, including static-motion users',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});await mount(t);await editSam();const form=document.querySelector('.fact-form')!;
  await enter(form.querySelector<HTMLInputElement>('input[inputmode=decimal]')!,'30');await click(button('Apply changes',form));
  assert.ok(document.querySelector('[data-person-fact="budget-1"] .row-update-flash'));
  assert.equal(document.querySelector<HTMLDetailsElement>('.plan-details')!.open,false,'a card edit restores the compact sources disclosure');
  await act(async()=>{t.mock.timers.tick(1200);await settle();});assert.equal(document.querySelectorAll('.row-update-flash').length,0);assert.match(document.querySelector('[data-person-fact="budget-1"]')!.textContent!,/\$30\/person/);
});

test('supported roster fixtures keep stable identity accents, balanced row metadata and all facts inside existing schema limits',async t=>{
  const {peopleColumns,personAccent}=await import('./peoplePresentation');const {savedSummarySchema}=await import('@fuzl/planning');
  for(const count of [1,2,3,4,5,6,12,20]){
    const value=peopleFixture(count);assert.ok(savedSummarySchema.safeParse(value.summary).success,`schema-valid ${count}`);
    const rendered=renderToStaticMarkup(<SummaryReview summary={value.summary} onChange={()=>{}}/>);const columns=peopleColumns(count);assert.ok(rendered.includes(`data-columns="${columns}"`));assert.ok(rendered.includes(`data-remainder="${count%columns}"`));assert.equal((rendered.match(/class="person-card"/g)||[]).length,count);
  }
  assert.equal(peopleColumns(4),2);assert.equal(peopleColumns(6),3);
  const {replace}=await mount(t);const sam=document.querySelector<HTMLElement>('[data-person-id="p1"]')!,tone=sam.style.getPropertyValue('--avatar-tone');
  const reordered=peopleFixture(2).summary;reordered.participants.reverse();await act(async()=>{replace(reordered);await settle();});assert.equal(document.querySelector('[data-person-id="p1"]'),sam);assert.equal(sam.style.getPropertyValue('--avatar-tone'),tone);assert.equal(tone,personAccent('p1'));
});

test('accepted extraction facts can reach planning without opening People cards or changing review labels',async t=>{
  const summary=peopleFixture(2).summary;for(const f of summary.facts){f.extraction={reviewed:false,reportedStatus:f.status,scope:'current',uncertainty:'Synthetic validated-source claim',supersedes:[]};if(f.status==='confirmed')f.status='proposed';}
  const {requests}=await mount(t,summary);assert.equal(requests.length,0);assert.ok([...document.querySelectorAll<HTMLDetailsElement>('.person-more')].every(d=>!d.open));
  await planningTools();assert.equal(document.querySelector<HTMLDetailsElement>('.planning-tools')!.open,true);assert.equal(requests.length,0,'opening tools is not consent to send');
  await click(button('Suggest a plan'));assert.equal(requests.length,1);assert.ok(requests[0].summary.facts.every(f=>f.extraction?.reviewed===false));assert.match(document.querySelector('.plan-proposal-result')!.textContent!,/No supplied option passes the firm checks/);
});
