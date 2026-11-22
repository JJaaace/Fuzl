import { useEffect, useRef, useState } from 'react';
import { useAccount } from './AccountProvider';
import { RequestLifetime } from './api';
import { requestMagicLink } from './magicLink';
import SignInJourney from './SignInJourney';
import DotField from '../ui/DotField';
import FuseDots from '../ui/FuseDots';

export interface SignInViewProps {
  email?:string; reauthenticating?:boolean; ready:boolean; loading:boolean; error:string;
  onReload:()=>void; onSend:(email:string)=>Promise<string>;
}
// Presentation seam permits synthetic state checks without a real email or auth session.
export function SignInView({email:initialEmail='',reauthenticating=false,ready,loading,error,onReload,onSend}:SignInViewProps) {
  const [email,setEmail]=useState(initialEmail),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
  const field=useRef<HTMLInputElement>(null), sentHeading=useRef<HTMLHeadingElement>(null), lifetime=useRef(new RequestLifetime()), lock=useRef(false);
  const focusFrame=useRef<number|null>(null);
  useEffect(()=>{const active=new RequestLifetime();lifetime.current=active;return()=>{active.dispose();if(focusFrame.current!==null)cancelAnimationFrame(focusFrame.current);};},[]);
  function editEmail(){setSent(false);setMessage('Send another link only if needed; development delivery has a small quota.');setFailed(false);focusFrame.current=requestAnimationFrame(()=>{focusFrame.current=null;field.current?.focus({preventScroll:true});});}
  return <><DotField active dimmed={false} oval/><section className="signin-experience" aria-labelledby="signin-title"><SignInJourney/><div className="signin-form-panel">
    <p className="eyebrow">Make room for the next one</p><h2 id="signin-title">Your next plan starts here.</h2><p className="signin-subtitle">Sign in to save plans and return to your groups.</p>
    {sent?<div className="signin-sent"><h3 ref={sentHeading} tabIndex={-1}>Check your email</h3><p>Link requested for <strong>{email}</strong>.</p><p>Open the link in this browser, preferably a new tab. Then return here without reloading to keep your unsaved work.</p><p className="note">A requested link does not mean you’re signed in. No planning data was sent.</p><button type="button" className="quiet" onClick={editEmail}>Edit email</button></div>:<form noValidate onSubmit={event=>{
      event.preventDefault();if(!ready||loading||lock.current||sent)return;
      if(!event.currentTarget.checkValidity()){setMessage('Enter a valid email address.');setFailed(true);field.current?.focus({preventScroll:true});return;}
      lock.current=true;const sequence=lifetime.current.capture();setBusy(true);setFailed(false);setMessage('');
      void onSend(email.trim()).then(failure=>{
        if(!lifetime.current.current(sequence))return;
        if(failure){setMessage(failure);setFailed(true);}else{setSent(true);setMessage('');focusFrame.current=requestAnimationFrame(()=>{focusFrame.current=null;sentHeading.current?.focus({preventScroll:true});});}
      }).catch(()=>{if(lifetime.current.current(sequence)){setMessage('Could not reach sign-in. Your temporary work was kept.');setFailed(true);}}).finally(()=>{if(lifetime.current.current(sequence)){lock.current=false;setBusy(false);}});
    }}><label className="field"><span>Email</span><input ref={field} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} disabled={busy} aria-describedby="signin-workspace-note" onChange={event=>setEmail(event.target.value)}/></label>
      <button type="submit" className="primary signin-submit" disabled={!ready||busy||loading} aria-busy={busy}>{busy?<><FuseDots/>Sending link…</>:failed?'Try again':'Send sign-in link'}</button>
    </form>}
    {loading&&<p role="status" className="notice">Checking account configuration…</p>}{error&&<p role="alert" className="validation-error">{error}</p>}
    {message&&<p className={failed?'validation-error':'note'} role={failed?'alert':'status'}>{message}</p>}
    <p className="note" id="signin-workspace-note">Signing in uploads no draft, image or transcript. Keep your original workspace tab open.</p>
    {reauthenticating&&<p className="note account-switch-note">Using a different account clears the previous account’s workspace. Return with Back to saved groups after completing the link.</p>}
    {(!ready||error)&&<button type="button" className="quiet" disabled={loading||busy} onClick={onReload}>Reload account configuration</button>}
    <details className="signin-setup"><summary>Development delivery</summary><p className="note">The default sender is limited to Supabase organization-member emails and a small project sending quota. Check setup before requesting a link; retries are always deliberate.</p></details>
  </div></section></>;
}
export default function SignIn(){
  const {client,loading,error,session,reload}=useAccount();
  return <SignInView email={session?.user.email} reauthenticating={!!session} ready={!!client} loading={loading} error={error} onReload={reload} onSend={email=>client?requestMagicLink(client.auth,email,window.location.origin):Promise.resolve('Account configuration is unavailable. Your temporary work was kept.')}/>;
}
