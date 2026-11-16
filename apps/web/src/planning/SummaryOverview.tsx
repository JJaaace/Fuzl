import { useEffect, useRef, useState } from 'react';
import type { PlanningSummary } from './model';
import { factValue } from './model';
import { cardFactText, commonWindow } from '@fuzl/planning';
import Icon from '../ui/Icon';
import type { ReactNode } from 'react';
export default function SummaryOverview({ summary, active = true, nextAction }: { summary: PlanningSummary; active?: boolean; nextAction?: ReactNode }) {
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
  const window = commonWindow(summary);
  const issue = summary.questions.find(q => q.resolution === null && q.kind === 'conflict') ?? summary.questions.find(q => q.resolution === null);
  const unreviewed = current.filter(f => f.extraction && !f.extraction.reviewed).length;
  const timing = current.find(f => f.kind === 'schedule');
  const shared = current.filter(f => f.subject.kind === 'group' && f.kind !== 'activity' && f.kind !== 'schedule');
  return <section className={`summary-overview plan-overview ${active && !settled ? 'is-revealing' : ''}`} aria-label="Current plan">
    {unreviewed > 0 && <p className="review-notice"><Icon name="spark" />{unreviewed} AI claims need your review · fact status is separate</p>}
    <div className="plan-result"><p className="eyebrow">The plan so far</p><h3>{activity ? factValue(activity) : 'Choose an activity together'}</h3>
      <p className="plan-window">{window.label}</p>
      {!window.date && timing?.kind === 'schedule' && <p className="note">{timing.description ?? 'Date unknown'} · Exact date unresolved · {timing.status}</p>}
      {activity && <p className={`fact-status status-${activity.status}`}>{activity.status} · {activity.strength === 'firm' ? 'Firm' : activity.strength === 'flexible' ? 'Flexible' : 'Firmness unknown'} · not a booking</p>}
      {shared.length>0 && <details><summary>Shared requirements</summary>{shared.map(f=><p key={f.id}>{cardFactText(f)} · {f.strength} · {f.status}</p>)}</details>}
      <p className="plan-open-question">{issue?.text ?? 'No open questions recorded'}</p>
    </div>
    <div className="plan-next-action">{nextAction ?? <p className="note">Inspect the candidate facts and sources, then explicitly choose whether to use this summary.</p>}</div>
  </section>;
}
