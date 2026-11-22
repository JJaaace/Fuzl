import { useState } from 'react';
import { SignInView } from './SignIn';
import Logo from '../ui/Logo';
const modes=['Success','Sending','Error','Not configured','Loading'] as const;
export default function SignInPreview(){
  const [mode,setMode]=useState<typeof modes[number]>('Success');
  return <div className="page"><header className="app-header"><a className="brand" href="/"><Logo size={36}/>Fuzl</a><span className="note">Synthetic sign-in preview · no email or auth request</span></header><main className="signin-preview"><div className="actions" aria-label="Mock sign-in states">{modes.map(value=><button key={value} aria-pressed={value===mode} onClick={()=>setMode(value)}>{value}</button>)}</div><SignInView key={mode} email="organizer@example.invalid" ready={mode!=='Not configured'} loading={mode==='Loading'} error={mode==='Not configured'?'Synthetic setup missing. Your temporary workspace still works.':''} onReload={()=>setMode('Success')} onSend={async()=>{if(mode==='Sending')return new Promise<string>(()=>{});await new Promise(resolve=>setTimeout(resolve,400));return mode==='Error'?'Synthetic delivery error. No email was sent.':'';}}/></main></div>;
}
