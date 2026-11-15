import { useEffect, useRef, useState } from 'react';
import type { PlanningSummary } from './model';
import { factValue, subjectLabel } from './model';
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
  const timing = current.filter(fact => fact.kind === 'schedule');
  const activity = current.find(fact => fact.kind === 'activity' && fact.description?.trim());
  const budgets = current.filter(fact => fact.kind === 'budget');
  const open = summary.questions.filter((question) => question.resolution === null).length;
  const unreviewed = summary.facts.filter((fact) => fact.extraction && !fact.extraction.reviewed).length;
  const missing: string[] = [];
  if (current.some(fact => fact.status === 'conflicting')) missing.push('Conflicting requirements need review');
  if (!timing.length || timing.some(fact => fact.exactDate === null)) missing.push('Exact date unresolved');
  const tentative = timing.find(fact => fact.status === 'tentative');
  if (tentative) missing.push(`${subjectLabel(tentative.subject, summary)}: tentative availability`);
  if (!timing.length || timing.some(fact => fact.startTime === null || fact.endTime === null)) missing.push('Time window incomplete');
  if (!budgets.length || budgets.some(fact => fact.amount === null || fact.currency === null)) missing.push('Budget amounts or currency missing');
  if (!activity) missing.push('Activity not chosen');
  if (!missing.length && open) missing.push(summary.questions.find(question => question.resolution === null)!.text);
  return <div className={`summary-overview ${active && !settled ? 'is-revealing' : ''}`}>
    {unreviewed > 0 && <p className="review-notice"><Icon name="spark" /><strong>{unreviewed} AI {unreviewed === 1 ? 'claim needs' : 'claims need'} your review</strong><span>Review is separate from fact status.</span></p>}
    <p className="overview-people"><Icon name="users" />{summary.participants.length ? summary.participants.map((person) => person.name?.trim() || 'Unknown name').join(', ') : 'People not known yet'}</p>
    <dl className="overview-grid">
      <div><dt>What’s the plan?</dt><dd>{activity ? <><strong>{factValue(activity)}</strong><span className="overview-detail">{activity.status} · {activity.strength === 'firm' ? 'firm requirement' : activity.strength === 'flexible' ? 'flexible idea' : 'firmness unknown'}</span></> : <strong>Activity not chosen yet</strong>}
        {timing[0] && <><span className="overview-line">{timing[0].description ?? 'Availability description unknown'}</span><span className="overview-detail">{timing[0].status} · {timing[0].exactDate ?? 'Exact date unresolved'}{timing[0].startTime && ` · ${timing[0].startTime}${timing[0].endTime ? `–${timing[0].endTime}` : ''}`}</span></>}
      </dd></div>
      <div><dt>What’s still open?</dt><dd>{missing.length ? <ul className="overview-missing">{missing.slice(0,3).map(text => <li key={text}>{text}</li>)}</ul> : <span>No missing details flagged here. Check the facts before choosing.</span>}<span className="overview-detail">{open ? `${open} open ${open === 1 ? 'question' : 'questions'}` : 'No questions recorded'}{missing.length > 3 && ' · More details need checking below'}</span></dd></div>
      <div className="summary-next"><dt>What can I do next?</dt><dd>{nextAction ?? <p className="note">Inspect the candidate facts and sources below, then choose whether to use this summary.</p>}</dd></div></dl>
  </div>;
}
