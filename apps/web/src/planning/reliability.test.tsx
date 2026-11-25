import {samplePlanFor} from './samplePlans';
import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import type {TestContext} from 'node:test';
import {GlobalRegistrator} from '@happy-dom/global-registrator';
import {GEMINI_MODEL,analysisResponseSchema} from '@fuzl/planning';
import {examples} from './examples';
import RenderBoundary,{getRenderFailure} from '../ui/RenderBoundary';
import {SiteNavigationProvider,PrimaryNavigation} from '../ui/SiteNavigation';
GlobalRegistrator.register({url:'http://192.168.12.248:5174',settings:{enableJavaScriptEvaluation:false,disableJavaScriptFileLoading:true,enableCSSFileLoading:false,enableImageFileLoading:false}});Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});window.confirm=()=>true;
const {act}=await import('react'),{createRoot}=await import('react-dom/client'),{default:App}=await import('../App');
after(()=>GlobalRegistrator.unregister());const tick=()=>new Promise<void>(r=>setImmediate(r));
async function click(node:Element|null){assert.ok(node);await act(async()=>{(node as HTMLElement).click();await tick();});}
function visible(node:Element){return !node.closest('[hidden]');}
function action(label:string){const value=[...document.querySelectorAll('button,a.nav-button')].find(e=>visible(e)&&e.textContent?.trim()===label);assert.ok(value,label);return value;}
async function mount(t:TestContext,element?:React.ReactNode,provider?:(url:string)=>Promise<Response>){const calls:string[]=[];t.mock.method(globalThis,'fetch',async(input:string)=>{calls.push(input);if(input==='/api/ai-config')return Response.json({provider:'gemini',model:GEMINI_MODEL});if(provider)return provider(input);throw Error('No other network in this synthetic DOM test');});const host=document.createElement('div');document.body.append(host);const root=createRoot(host,{onCaughtError:()=>{}});t.after(async()=>{await act(async()=>root.unmount());host.remove();});await act(async()=>{root.render(element??<App/>);await tick();});return{host,root,calls};}
test('regression: all sample cards, repeated replacement and blank-summary editor render when crypto.randomUUID is unavailable on HTTP LAN',async t=>{
 const descriptor=Object.getOwnPropertyDescriptor(crypto,'randomUUID');Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});t.after(()=>{if(descriptor)Object.defineProperty(crypto,'randomUUID',descriptor);else Reflect.deleteProperty(crypto,'randomUUID');});
 const{calls}=await mount(t);for(const name of ['Saturday bowling','Friday, maybe','Indoors or outdoors?','Friday, maybe']){const card=document.querySelector(`[aria-label="Open sample: ${name}"]`);await click(card);assert.equal(document.querySelector('#summary-title')!.textContent,name);assert.ok(document.querySelector('.outing-card'));await click([...document.querySelectorAll('.stage-nav button')].find(e=>e.textContent?.includes('Conversation'))!);}
 await click(action('Start a plan from scratch'));assert.ok(document.querySelector('.summary-panel'));assert.ok(calls.every(url=>url==='/api/ai-config'));
});
test('panel boundary retains the parent draft, hides exception content, exposes a stable diagnostic reference and recovers on retry',async t=>{
 let broken=false;const failure=new Error('PRIVATE synthetic canary must never appear in recovery UI');failure.name='PRIVATE error name';const logs:unknown[][]=[];t.mock.method(console,'error',(...values:unknown[])=>{logs.push(values);});
 function Child(){if(broken)throw failure;return <p>Restored plan content</p>;}
 const{host,root}=await mount(t,<><textarea defaultValue="Synthetic draft stays in memory"/><RenderBoundary><Child/></RenderBoundary></>);broken=true;
 await act(async()=>{root.render(<><textarea defaultValue="Synthetic draft stays in memory"/><RenderBoundary><Child/></RenderBoundary></>);await tick();});
 assert.equal(host.querySelector('textarea')!.value,'Synthetic draft stays in memory');assert.match(host.textContent!,/Retry this panel/);assert.ok(!host.textContent!.includes('PRIVATE'));const reference=host.querySelector('code')!.textContent!;assert.equal(getRenderFailure(reference)?.error,failure);assert.ok(!JSON.stringify(logs).includes('PRIVATE'));assert.match(JSON.stringify(logs),/UnknownError/);
 broken=false;await click(action('Retry this panel'));assert.match(host.textContent!,/Restored plan content/);assert.equal(host.querySelector('textarea')!.value,'Synthetic draft stays in memory');
});
test('primary navigation has one active destination and back/forward popstate restores workspace stage without putting drafts in history',async t=>{
 window.history.replaceState(null,'','/');await mount(t,<SiteNavigationProvider><App/></SiteNavigationProvider>);await click(document.querySelector('[aria-label="Open sample: Friday, maybe"]'));assert.equal(new URL(window.location.href).searchParams.get('stage'),'plan');
 await click(action('Saved groups'));assert.equal(document.querySelector('nav[aria-label="Main navigation"] [aria-current="page"]')!.textContent,'Saved groups');assert.equal(document.querySelectorAll('nav[aria-label="Main navigation"] [aria-current="page"]').length,1);
 await act(async()=>{window.history.replaceState({fuzl:{destination:'workspace',stage:'understanding'}},'','/?stage=plan');window.dispatchEvent(new PopStateEvent('popstate'));await tick();});assert.equal(document.querySelector('#summary-title')!.textContent,'Friday, maybe');assert.ok(visible(document.querySelector('.summary-panel')!));assert.equal(document.querySelector('nav [aria-current="page"]')!.textContent,'Workspace');assert.ok(!JSON.stringify(window.history.state).includes('Maybe after 7'));
 await act(async()=>{window.history.replaceState(null,'','/');window.dispatchEvent(new PopStateEvent('popstate'));await tick();});assert.ok(visible(document.querySelector('#draft')!));assert.equal(document.querySelector('.stage-nav [aria-current=step]')!.textContent,'1Conversation');
});
test('standalone primary navigation marks Conversations current without making another destination active',async t=>{await mount(t,<PrimaryNavigation current="conversations"/>);assert.equal(document.querySelectorAll('[aria-current="page"]').length,1);assert.equal(document.querySelector('[aria-current="page"]')!.textContent,'Conversations');});

test('a result arriving after navigation does not pull the visitor out of Saved groups; explicit preview still opens Plan',async t=>{
 window.history.replaceState(null,'','/');let finish:((response:Response)=>void)|undefined;
 await mount(t,<SiteNavigationProvider><App/></SiteNavigationProvider>,()=>new Promise(resolve=>{finish=resolve;}));
 const draft=document.querySelector<HTMLTextAreaElement>('#draft')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(draft,examples[1].conversation);draft.dispatchEvent(new Event('input',{bubbles:true}));await tick();});
 await click(action('Make the plan'));await click(action('Saved groups'));
 const summary=structuredClone(examples[1].summary);summary.facts=summary.facts.filter(f=>f.sourceIds.length);for(const fact of summary.facts){fact.extraction={reviewed:false,reportedStatus:fact.status,scope:'current',uncertainty:'Synthetic claim requires review.',supersedes:[]};if(fact.status==='confirmed')fact.status='proposed';}summary.questions=summary.questions.map(q=>({...q,relatedFactIds:q.relatedFactIds.filter(id=>summary.facts.some(f=>f.id===id))}));
 const response=analysisResponseSchema.parse({summary,proposal:{...samplePlanFor('tentative',summary),origin:'ai'},warnings:[],metrics:{provider:'gemini',model:GEMINI_MODEL,latencyMs:0,inputTokens:null,outputTokens:null,estimatedCostUsd:null}});
 assert.ok(finish);await act(async()=>{finish!(Response.json(response));await tick();await tick();});
 assert.equal(document.querySelector('nav [aria-current=page]')!.textContent,'Saved groups');
 await click(action('Workspace'));assert.equal(draft.value,examples[1].conversation);await click(action('Review AI preview'));assert.ok(visible(document.querySelector('.analysis-result')!));assert.equal(document.querySelector('.stage-nav [aria-current=step]')!.textContent,'2Plan');assert.equal(document.querySelector('.summary-panel'),null);
});

test('hosted imports explain the membership-checked chat path before submission and keep offline samples usable',async t=>{
 const browser=window as unknown as {happyDOM:{setURL:(url:string)=>void}};const original=window.location.href;
 browser.happyDOM.setURL('https://fuzl-beta.example/');t.after(()=>browser.happyDOM.setURL(original));
 const {calls}=await mount(t);const draft=document.querySelector<HTMLTextAreaElement>('#draft')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(draft,'Synthetic planning discussion');draft.dispatchEvent(new Event('input',{bubbles:true}));await tick();});
 assert.equal((action('Make the plan') as HTMLButtonElement).disabled,true);assert.match(document.querySelector('.analysis-controls')!.textContent!,/signed-in group/);
 await click(document.querySelector('[aria-label="Open sample: Friday, maybe"]'));assert.equal(document.querySelector('#summary-title')!.textContent,'Friday, maybe');
 assert.ok(calls.every(url=>url==='/api/ai-config'),'no anonymous hosted analysis or provider request');
});
