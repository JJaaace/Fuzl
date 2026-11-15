import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register({url:'http://127.0.0.1:5173/?design=travel',settings:{enableJavaScriptEvaluation:false,disableJavaScriptFileLoading:true,enableCSSFileLoading:false,enableImageFileLoading:false}});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});window.confirm=()=>true;
const {act}=await import('react'),{createRoot}=await import('react-dom/client'),{default:Demo}=await import('./TravelDemo'),{default:Panel}=await import('./TravelPanel');
after(()=>GlobalRegistrator.unregister());const settle=()=>new Promise<void>(r=>setImmediate(r));
const button=(text:string,root:ParentNode=document)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text);assert.ok(b,text);return b;};
async function click(e:HTMLElement){await act(async()=>{e.click();await settle();});}
async function mount(t:TestContext,node:React.ReactNode){const div=document.createElement('div');document.body.append(div);const root=createRoot(div);t.after(async()=>{await act(async()=>root.unmount());div.remove();});await act(async()=>{root.render(node);await settle();});}
async function wait(check:()=>boolean){for(let i=0;i<100&&!check();i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});assert.ok(check());}
const names=()=>[...document.querySelectorAll('.place-finder .fit-fits h4')].map(h=>h.textContent);
const toggle=()=>{const node=[...document.querySelectorAll('label')].find(l=>l.textContent==='Balance travel')?.querySelector('input');assert.ok(node);return node;};
test('real fixture controls toggle loaded cards, preserve shortlist and recheck changed scope/history without network',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('No network in fixture');});await mount(t,<Demo/>);await click(button('Show demo results'));assert.deepEqual(names(),['Synthetic central garden','Synthetic east garden']);
  await click(button('Add to shortlist',document.querySelector('.place-card')!));const selected=[...document.querySelectorAll('label')].find(l=>l.textContent?.startsWith('Public option name'))?.querySelector('input');assert.ok(selected);assert.equal(selected.value,'Synthetic central garden');
  await click(toggle());assert.deepEqual(names(),['Synthetic east garden','Synthetic central garden']);assert.ok(document.querySelector('.fit-fits')?.textContent?.includes('Helps balance travel across recent outings.'));assert.equal(selected.value,'Synthetic central garden');
  await click(button('Reviewed subset · Avery & Blake'));assert.equal(names().length,0);assert.equal(selected.value,'Synthetic central garden');await click(button('Show demo results'));assert.deepEqual(names(),['Synthetic central garden','Synthetic east garden']);
  await click(button('Everyone · three attendees'));await click(button('Show demo results'));assert.deepEqual(names(),['Synthetic east garden','Synthetic central garden']);
  await click(button('Delete one outing’s travel records'));await click(button('Show demo results'));assert.deepEqual(names(),['Synthetic central garden','Synthetic east garden']);assert.equal(selected.value,'Synthetic central garden');
  await click(button('Other group · no comparable history'));await click(button('Show demo results'));assert.deepEqual(names(),['Synthetic central garden','Synthetic east garden']);
  await click(button('Clear current travel estimates'));await click(button('Show demo results'));assert.equal(names().length,0);assert.ok(document.querySelector('.fit-does-not-fit')?.textContent?.includes('Synthetic over-budget garden'));assert.equal(calls,0);
});
test('private travel editor keeps blank minutes unknown, requires explicit review and retains the same retry identity after a lost response',async t=>{
  const {travelFixture}=await import('@fuzl/planning');const f=travelFixture(),bodies:unknown[]=[];let writes=0;const dashboard={revision:0,scope:f.scope,setup:null,current:false,aliases:f.travel.setup.mappings.map((m,i)=>({id:m.aliasId,name:f.summary.participants[i].name!})),outings:[]};
  t.mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{if(init?.method==='PUT'){writes++;bodies.push(JSON.parse(String(init.body)));throw Error('Synthetic lost response');}return Response.json(dashboard);});
  const loaded={id:crypto.randomUUID(),groupId:crypto.randomUUID(),revision:1,title:'Synthetic',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),payload:{title:'Synthetic',summaryVersion:1 as const,origin:'manual' as const,provenance:[],summary:f.summary}};
  await mount(t,<Panel token="synthetic-owner-token" loaded={loaded} candidates={[{key:f.travel.setup.estimates[0].key,name:'Synthetic',address:f.candidate.address,window:f.window}]} onChanged={()=>{}}/>);
  await click(button('Load / reload private travel data'));await wait(()=>!!document.querySelector('fieldset'));await click(button('Use loaded options for estimates'));
  const input=[...document.querySelectorAll('label')].find(l=>l.textContent==='Travel estimate source link')!.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'https://example.com/synthetic-route');input.dispatchEvent(new Event('input',{bubbles:true}));await settle();});
  assert.equal(button('Save reviewed session travel').disabled,true);await click([...document.querySelectorAll('label')].find(l=>l.textContent?.startsWith('I reviewed the identities'))!.querySelector('input')!);await click(button('Save reviewed session travel'));await wait(()=>writes===1);await click(button('Save reviewed session travel'));await wait(()=>writes===2);assert.deepEqual(bodies[0],bodies[1]);const sent=bodies[0] as {setup:{estimates:{minutes:{minutes:null}[]}[]}};assert.ok(sent.setup.estimates[0].minutes.every(m=>m.minutes===null));assert.equal(input.value,'https://example.com/synthetic-route');
});
