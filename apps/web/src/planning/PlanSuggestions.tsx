import { useEffect, useRef, useState } from 'react';
import { proposalWindow, moneyText, planProposalResponseSchema } from '@fuzl/planning';
import type { PlanProposalRequest, PlanProposalResponse, PlanningSummary } from '@fuzl/planning';
import ManualPlace from '../places/ManualPlace';
import FuseDots from '../ui/FuseDots';
import { localActionsAvailable, localWorkspaceUrl } from './localActions';

export interface ProposalContext { saved?: PlanProposalRequest['saved']; token?: string; getEditRevision?: () => number; initialManual?: PlanProposalRequest['manual'] }
export default function PlanSuggestions({ summary, saved, token, getEditRevision = () => 0, initialManual = [] }: ProposalContext & { summary: PlanningSummary }) {
  const localAllowed=typeof window==='undefined'||localActionsAvailable(window.location.origin);
  // Saved attendee scopes are projected on the server; the full group may differ.
  const windowReady=!!saved||proposalWindow(summary).date!==null;
  const [manual, setManual] = useState(initialManual);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [result,setResult] = useState<{ value: PlanProposalResponse; key: string } | null>(null);
  const pending = useRef<AbortController | null>(null), lock = useRef(false), root = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([summary,manual,saved]);
  const latest = useRef(key);
  useEffect(()=>{latest.current=key;},[key]);
  useEffect(()=>()=>{pending.current?.abort();},[]);
  async function run(checksOnly: boolean) {
    if(lock.current) return;
    if(!localAllowed){setError('Open Fuzl on the Mac running it at '+localWorkspaceUrl+'. Your facts were kept; no provider was called.');return;}

    if(root.current?.closest('.summary-review')?.querySelector('.fact-form')) {setError('Apply or cancel open edits first. Your fields were kept.');return;}
    const controller = new AbortController(); pending.current=controller;lock.current=true;setBusy(true);setError('');
    const revision=getEditRevision(), snapshot=key;
    const request: PlanProposalRequest={summary,manual,expectedProvider:'gemini',...(saved?{saved}:{})};
    try {
      const response=await fetch(checksOnly?'/api/check-plan':'/api/suggest-plan',{method:'POST',headers:{'Content-Type':'application/json',...(saved&&token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(request),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(55000)]),cache:'no-store'});
      let body: unknown;
      try {body=await response.json();} catch {throw Error('The API response could not be read. Your facts were kept; retry deliberately.');}
      if(!response.ok) {
        const value=body as {error?:{message?:unknown;reference?:unknown}};
        const message=typeof value.error?.message==='string'?value.error.message:'Plan suggestions could not complete. Your facts were kept.';
        const reference=typeof value.error?.reference==='string'&&/^[\da-f-]{36}$/.test(value.error.reference)?` Error reference: ${value.error.reference}`:'';
        throw Error(message+reference);
      }
      const value=planProposalResponseSchema.parse(body);
      if(controller.signal.aborted||pending.current!==controller) return;
      if(latest.current!==snapshot||getEditRevision()!==revision||root.current?.closest('.summary-review')?.querySelector('.fact-form')) {setError('Planning facts or edits changed while waiting. The stale suggestion was discarded. Request again explicitly.');return;}
      setResult({value,key:snapshot});
    } catch(failure) {
      if(controller.signal.aborted||pending.current!==controller)return;
      setError(failure instanceof Error&&failure.name!=='ZodError'?failure.message:'The proposal response was invalid. Nothing was accepted.');
    } finally {if(pending.current===controller){pending.current=null;lock.current=false;setBusy(false);}}
  }
  return <div className="plan-suggestions" ref={root}>
    {!localAllowed&&<p className="notice local-suggestions-notice">To use AI suggestions, open Fuzl on the Mac running it at <a href={localWorkspaceUrl} target="_blank" rel="noreferrer">{localWorkspaceUrl}</a>. Keep this tab open; drafts do not transfer between addresses. Offline samples and editing work here. Server fit checks also require the Mac URL.</p>}
    {!windowReady&&<p className="proposal-prerequisite">General ideas can be compared now. An exact date and time window is still required for date-specific event or availability checks.</p>}
    <p className="provider-disclosure">Gemini receives eligible activity/candidate labels and a known group window. Participant records, source quotes, budget fields and private answers are excluded. Candidate labels you supply are sent. Unpaid Google content may be used for improvement and human review.</p>
    <div className="actions"><button type="button" data-workspace-navigation className="primary" disabled={busy||!localAllowed} aria-busy={busy} onClick={()=>void run(false)}>{busy?<><FuseDots/>Preparing…</>:'Suggest a plan'}</button><button type="button" data-workspace-navigation disabled={busy||!localAllowed} onClick={()=>void run(true)}>Check fit without AI</button>{busy&&<button type="button" data-workspace-navigation onClick={()=>{pending.current?.abort();pending.current=null;lock.current=false;setBusy(false);setError('Cancelled locally. Facts kept; an already-started Gemini request may still use quota.');}}>Cancel suggestion</button>}</div>
    <details className="proposal-candidates"><summary>Candidate details · {manual.length} organizer-entered</summary><p className="note">Without a candidate, current source-linked activity ideas have unknown costs, location, hours and travel. Gemini chooses among supplied ideas; it does not look up venues or invent evidence. Add known candidate details before checking them.</p>
      <ManualPlace disabled={busy||manual.length>=3} onAdd={candidate=>{if(manual.length>=3)return false;setManual([...manual,candidate]);return true;}}/>
      {manual.map((candidate,index)=><div key={index} className="manual-plan-candidate"><strong>{candidate.name}</strong> · {moneyText(candidate.price.amount,candidate.price.currency,candidate.price.basis==='per-person')} · {candidate.price.coverage==='total'?'Organizer-entered total':'Total cost unresolved'} <button className="quiet" disabled={busy} onClick={()=>setManual(manual.filter((_,i)=>i!==index))}>Remove candidate</button></div>)}
    </details>
    {error&&<p role="alert" className="validation-error">{error}</p>}
    {result&&result.key!==key&&<p role="status" className="source-warning">Planning facts or candidates changed. Previous suggestions are out of date; recheck before using them.</p>}
    {result&&result.key===key&&<section className="plan-proposal-result" aria-label="Plan proposal and checks"><p role="status">{result.value.message}</p><p className="note">{result.value.scope.label} · {result.value.scope.count} attendees · {result.value.window.label} · {saved?'Owned saved-session constraints checked on the server':'Temporary workspace · no saved private answers available'}</p>
      {result.value.candidates.map(item=><article key={item.candidate.id} className={`proposal-option fit-${item.status}`}><h4>{item.candidate.name}{result.value.selectedId===item.candidate.id&&<span className="badge">Gemini proposal · unreviewed</span>}</h4><p>{item.status==='does-not-fit'?'Excluded by firm checks':item.status==='fits'?'Fits supplied checks':'Still needs checking'} · {moneyText(item.candidate.price.amount,item.candidate.price.currency,item.candidate.price.basis==='per-person')}</p><details><summary>Fit checks &amp; unresolved details</summary><ul>{item.checks.map((check,i)=><li key={i}>{check.status==='does-not-fit'?'Doesn’t fit':check.status==='fits'?'Fits':'Needs checking'} · {check.detail}</li>)}</ul></details></article>)}
      {result.value.metrics&&<details><summary>Request details</summary><p className="note">{result.value.metrics.model} · {result.value.metrics.latencyMs}ms · Input {result.value.metrics.inputTokens??'unknown'} / output {result.value.metrics.outputTokens??'unknown'} tokens · Cost {result.value.metrics.estimatedCostUsd===null?'unavailable':moneyText(result.value.metrics.estimatedCostUsd,'USD')}</p></details>}
    </section>}
  </div>;
}
