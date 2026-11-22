import assert from 'node:assert/strict';
import { after,test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register({url:'http://127.0.0.1:5173',settings:{enableJavaScriptEvaluation:false,disableJavaScriptFileLoading:true,enableCSSFileLoading:false,enableImageFileLoading:false}});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const {act}=await import('react');const {createRoot}=await import('react-dom/client');const {SignInView}=await import('./SignIn');
after(async()=>{await GlobalRegistrator.unregister();});
const settle=()=>new Promise<void>(r=>setImmediate(r));
async function click(element:Element|null){assert.ok(element);await act(async()=>{(element as HTMLElement).click();await settle();});}
async function enter(value:string){const input=document.querySelector<HTMLInputElement>('input[type=email]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));await settle();});}
async function submit(){await act(async()=>{document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();});}
async function mount(t:TestContext,onSend:(email:string)=>Promise<string>,extra:Partial<Parameters<typeof SignInView>[0]>={}){
  let closed=false;const container=document.createElement('div');document.body.append(container);const root=createRoot(container);const unmount=async()=>{if(closed)return;closed=true;await act(async()=>root.unmount());container.remove();};t.after(unmount);
  await act(async()=>{root.render(<SignInView ready loading={false} error="" onReload={()=>{}} onSend={onSend} {...extra}/>);await settle();});return {unmount,container};
}

test('sign-in validates email, keeps a labelled autocomplete field, and sends no data on entry',async t=>{
  let calls=0;await mount(t,async()=>{calls++;return '';});
  assert.match(document.querySelector('#signin-title')!.textContent!,/Your next plan starts here/);
  const input=document.querySelector<HTMLInputElement>('input')!;assert.equal(input.autocomplete,'email');assert.equal(input.type,'email');assert.equal(calls,0);
  await submit();assert.equal(calls,0);assert.match(document.querySelector('[role=alert]')!.textContent!,/valid email/);
  await enter('invalid');await submit();assert.equal(calls,0);assert.equal(document.activeElement,input);
});

test('one deliberate send shows stable loading then an honest sent state; Edit email restores the entered address and focus without resending',async t=>{
  let calls=0;let finish:((value:string)=>void)|undefined;
  await mount(t,async email=>{calls++;assert.equal(email,'organizer@example.invalid');return new Promise<string>(r=>{finish=r;});});await enter('organizer@example.invalid');
  const art=document.querySelector('.signin-art');await submit();await submit();assert.equal(calls,1);assert.equal(document.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled,true);assert.match(document.querySelector('button[type=submit]')!.textContent!,/Sending link/);
  assert.equal(document.querySelector('.signin-art'),art,'sending does not remount the illustration');
  await act(async()=>{finish!('');await settle();});assert.match(document.querySelector('.signin-sent')!.textContent!,/preferably a new tab/);assert.match(document.querySelector('.signin-sent')!.textContent!,/does not mean you’re signed in/);
  await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Edit email')!);for(let n=0;n<15&&document.activeElement!==document.querySelector('input');n++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
  assert.equal(document.querySelector<HTMLInputElement>('input')!.value,'organizer@example.invalid');assert.equal(document.activeElement,document.querySelector('input'));assert.equal(calls,1);
});

test('failed send preserves the email and allows one explicit retry; no automatic loop',async t=>{
  let calls=0;await mount(t,async()=>{calls++;return calls===1?'Synthetic quota error. Check setup before retrying.':'';});await enter('organizer@example.invalid');await submit();
  assert.equal(calls,1);assert.match(document.querySelector('[role=alert]')!.textContent!,/Synthetic quota/);assert.equal(document.querySelector<HTMLInputElement>('input')!.value,'organizer@example.invalid');
  assert.equal(document.querySelector('button[type=submit]')!.textContent,'Try again');await submit();assert.equal(calls,2);assert.ok(document.querySelector('.signin-sent'));
});

test('configuration errors allow reload; late responses after leaving do not create a fake signed-in state',async t=>{
  let reloads=0,calls=0;const first=await mount(t,async()=>{calls++;return '';},{ready:false,error:'Synthetic configuration unavailable',onReload:()=>{reloads++;},reauthenticating:true});
  assert.equal(document.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled,true);assert.match(document.querySelector('.account-switch-note')!.textContent!,/different account clears/);await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Reload account configuration')!);assert.equal(reloads,1);assert.equal(calls,0);await first.unmount();
  let finish:((value:string)=>void)|undefined;const second=await mount(t,async()=>new Promise<string>(r=>{finish=r;}));await enter('organizer@example.invalid');await submit();await second.unmount();await act(async()=>{finish!('');await settle();});assert.equal(document.querySelector('.signin-sent'),null);
});
