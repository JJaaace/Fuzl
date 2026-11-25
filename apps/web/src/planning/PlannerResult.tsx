import {useShortlist,useShortlistDraft} from '../ballots/context';
import {useRef,useState} from 'react';
import {moneyText,newRecordId,ballotOptionSchema} from '@fuzl/planning';
import type {OutingProposal} from '@fuzl/planning';
import {homepageCopy as copy} from './homepageCopy';
function clock(value:string|null){if(!value)return '';const[h,m]=value.split(':').map(Number);return `${h%12||12}${m?':'+String(m).padStart(2,'0'):''} ${h>=12?'PM':'AM'}`;}
export default function PlannerResult({plan,stale=false,onReview,saveAction,reviewLabel=copy.proposal.reviewQuestions}:{plan:OutingProposal;stale?:boolean;onReview?:()=>void;reviewLabel?:string;saveAction?:{label:string;onClick:()=>void}}){
 const add=useShortlist(),shortlist=useShortlistDraft();
 const field=useRef<HTMLTextAreaElement>(null),[copied,setCopied]=useState<'idle'|'copied'|'error'>('idle');
 const q=plan.questions;
 return <section className="planner-result" aria-label={copy.sections.plan}><span className="hero-plan-bar"/><header><p className="eyebrow">{plan.origin==='sample'?copy.proposal.sample:copy.proposal.ai}</p><h3>{copy.sections.plan}</h3><p className="planner-pick">{plan.activity}, {plan.dateLabel}{plan.startTime?` ${clock(plan.startTime)}`:''}</p><span className="badge">{copy.proposal.status}</span>{add&&<button disabled={stale||plan.fit==='does-not-fit'} onClick={()=>add(()=>ballotOptionSchema.parse({id:newRecordId(),kind:'idea',name:plan.activity,time:`Proposed: ${plan.date??plan.dateLabel} · ${plan.startTime??'time unknown'}`,location:plan.activityType,cost:{amount:plan.costPerPerson,currency:plan.currency,kind:plan.costPerPerson===null?'unknown':'starting',basis:'per-person'},links:[],unresolved:[...plan.checks,...plan.assumptions,copy.proposal.shortlistCheck],sample:plan.origin==='sample'}))}>{copy.proposal.addToShortlist}</button>}{saveAction&&<button className="summary-save-shortcut" onClick={saveAction.onClick}>{saveAction.label}</button>}{shortlist?.message&&<p role="status">{shortlist.message}</p>}{plan.fit==='does-not-fit'&&<p className="validation-error">{copy.proposal.firmConflict}</p>}</header>
 {stale&&<p role="alert" className="source-warning">{copy.proposal.stale}</p>}
 <section><h4>{copy.sections.details}</h4><p><strong>{copy.proposal.venueType}:</strong> {plan.activityType}</p><p>{plan.costPerPerson===null?copy.proposal.unknownCost:`Estimated ${moneyText(plan.costPerPerson,plan.currency,true)}`}{plan.currency===null&&plan.costPerPerson!==null?` · ${copy.proposal.unknownCurrency}`:''}</p><p>{plan.date??copy.proposal.unknownDate} · {plan.startTime?clock(plan.startTime):copy.proposal.unknownTime}{plan.endTime?`–${clock(plan.endTime)}`:''}</p><p className="note">{plan.travelNote} {plan.timingNote}</p></section>
 <section><h4>{copy.sections.why}</h4><p>{plan.why}</p></section>
 <section><h4>{copy.sections.backup}</h4><p>{plan.backup}</p></section>
 <section><h4>{copy.sections.message}</h4><textarea ref={field} readOnly value={plan.message} aria-label={copy.proposal.messageLabel} rows={3}/><button type="button" disabled={stale} onClick={()=>{if(!navigator.clipboard?.writeText){field.current?.select();setCopied('error');return;}void navigator.clipboard.writeText(plan.message).then(()=>setCopied('copied')).catch(()=>{field.current?.select();setCopied('error');});}}>{copied==='copied'?copy.proposal.copied:copy.proposal.copy}</button>{copied==='error'&&<p role="status" className="note">{copy.proposal.copyFailed}</p>}</section>
 <section><h4>{copy.sections.questions}</h4>{q.length?<><ul>{q.map((question,i)=><li key={i}>{question}</li>)}</ul>{onReview&&<button className="quiet" onClick={onReview}>{reviewLabel}</button>}</>:<p>{copy.proposal.questionsEmpty}</p>}</section>
 <details><summary>{copy.proposal.assumptions}</summary><ul>{[...plan.assumptions,...plan.checks].map((item,i)=><li key={i}>{item}</li>)}</ul><p className="note">{copy.proposal.unsaved}</p></details>
 </section>;
}
