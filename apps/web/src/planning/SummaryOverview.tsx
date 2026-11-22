import { useEffect, useId, useRef, useState } from 'react';
import type { PlanningSummary } from './model';
import { cardFactText } from '@fuzl/planning';
import Icon from '../ui/Icon';
import type { ReactNode } from 'react';
import { activityHeading, availabilityHeading, overviewQuestion } from './planPresentation';
export default function SummaryOverview({ summary, active = true, nextAction, onQuestion }: { onQuestion?: (id:string)=>void; summary: PlanningSummary; active?: boolean; nextAction?: ReactNode }) {
  const sky=useId();
  const [settled, setSettled] = useState(false);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true; timer.current = setTimeout(() => setSettled(true), 340);
  }, [active]);
  // Stage switches don't cancel/restart an entrance already in progress.
  useEffect(() => () => { clearTimeout(timer.current); started.current = false; }, []);
  const current = summary.facts.filter(fact => fact.extraction?.scope !== 'historical');
  const activity = current.find(fact => fact.kind === 'activity' && fact.description?.trim());
  const issue = overviewQuestion(summary);
  const unreviewed = current.filter(f => f.extraction && !f.extraction.reviewed).length;
  const shared = current.filter(f => f.subject.kind === 'group' && f.kind !== 'activity' && f.kind !== 'schedule');
  return <section className={`summary-overview plan-overview ${active && !settled ? 'is-revealing' : ''}`} aria-label="Current plan">
    {unreviewed > 0 && <p className="review-notice"><Icon name="spark" />{unreviewed} AI claims need your review · fact status is separate</p>}
    <div className="plan-result"><svg className="plan-mini-scene" viewBox="0 0 120 78" aria-hidden="true"><defs><linearGradient id={sky} x2="0" y2="1"><stop stopColor="#edcb8a"/><stop offset="1" stopColor="#ac7545"/></linearGradient></defs><rect width="120" height="78" rx="10" fill={`url(#${sky})`}/><circle cx="86" cy="24" r="10" fill="#ffe0a0"/><path d="M0 51 23 29 42 49 67 37 90 51 120 30V78H0Z" fill="#9d724e"/><path d="M0 64 29 47 56 62 82 48 120 58V78H0Z" fill="#634b38"/><path d="M0 72 34 61 66 74 100 62 120 66V78H0Z" fill="#322d29"/></svg><h3>{activityHeading(activity)}</h3>
      <p className="plan-window">{availabilityHeading(summary)}</p>
      {shared.length>0 && <details><summary>Shared requirements</summary>{shared.map(f=><p key={f.id}>{cardFactText(f)} · {f.strength} · {f.status}</p>)}</details>}
      <p className="plan-open-question">{issue.text}{issue.id&&onQuestion&&<button className="quiet question-link" onClick={()=>onQuestion(issue.id!)}>Review question →</button>}</p>
    </div>
    <div className="plan-next-action">{nextAction ?? <p className="note">Inspect the candidate facts and sources, then explicitly choose whether to use this summary.</p>}</div>
  </section>;
}
