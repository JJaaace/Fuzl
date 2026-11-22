import { useState } from 'react';
import { peopleFixture } from '@fuzl/planning';
import SummaryReview from './SummaryReview';
import Logo from '../ui/Logo';
export default function PeopleDemo() {
  const [count,setCount]=useState(6), [summary,setSummary]=useState(()=>peopleFixture(6).summary);
  const [version,setVersion]=useState(0);
  const [large,setLarge]=useState(false);
  return <div className={`page is-working people-demo ${large?'is-large-text':''}`}><header className="app-header"><a className="brand" href="/"><Logo size={36}/>Fuzl</a><span className="note">Synthetic People &amp; fit demo · no stored data</span></header><main><h1>Plan</h1><div className="actions">{([1,2,3,4,5,6,12,20] as const).map(n=><button key={n} aria-pressed={count===n} onClick={()=>{if(document.querySelector('.fact-form')&&!window.confirm('Replace unapplied fixture edits?'))return;setCount(n);setSummary(peopleFixture(n).summary);setVersion(v=>v+1);}}>{n} people</button>)}<button onClick={()=>setLarge(value=>!value)} aria-pressed={large}>Larger text</button><button onClick={()=>setSummary(value=>({...value,participants:value.participants.map((person,index)=>({...person,name:index===0?'Alexandria Nnedi Okonkwo-Martinez':index===1?'Sam With A Very Long Display Name':person.name}))}))}>Long names</button></div><p className="notice">Open Planning tools → Check fit without AI: the supplied $25/person option fails Sam’s $20 firm budget. Use Sam’s Edit → Edit budget per person, set 30 and Apply changes, then check again. Price no longer fails; venue/travel/booking details still need checking. Suggest a plan is a separate deliberate Gemini request.</p><section className="summary-panel"><h2 id="summary-title" tabIndex={-1}>Bowling fixture</h2><SummaryReview key={version} summary={summary} onChange={setSummary} proposal={{initialManual:peopleFixture(count).manual}}/></section></main></div>;
}
