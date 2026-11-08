import { useEffect, useRef, useState } from 'react';
import type { PlanningSummary } from './model';
import { factValue, subjectLabel } from './model';
import Icon from '../ui/Icon';
export default function SummaryOverview({ summary, active = true }: { summary: PlanningSummary; active?: boolean }) {
  const [settled, setSettled] = useState(false);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true; timer.current = setTimeout(() => setSettled(true), 340);
  }, [active]);
  // Stage switches don't cancel/restart an entrance already in progress.
  useEffect(() => () => { clearTimeout(timer.current); started.current = false; }, []);
  const timing = summary.facts.filter((fact) => fact.kind === 'schedule').filter(fact => fact.extraction?.scope !== 'historical');
  const budgets = summary.facts.filter((fact) => fact.kind === 'budget').filter(fact => fact.extraction?.scope !== 'historical');
  const open = summary.questions.filter((question) => question.resolution === null).length;
  const unreviewed = summary.facts.filter((fact) => fact.extraction && !fact.extraction.reviewed).length;
  return <div className={`summary-overview ${active && !settled ? 'is-revealing' : ''}`}>
    {unreviewed > 0 && <p className="review-notice"><Icon name="spark" /><strong>{unreviewed} AI {unreviewed === 1 ? 'claim needs' : 'claims need'} your review</strong><span>Review is separate from fact status.</span></p>}
    <p className="overview-people"><Icon name="users" />{summary.participants.length ? summary.participants.map((person) => person.name?.trim() || 'Unknown name').join(', ') : 'People not known yet'}</p>
    <dl className="overview-grid">
      <div><dt><Icon name="clock" />Availability</dt><dd>{timing.length ? <>{factValue(timing[0])}<span className="overview-detail">{timing[0].status}{timing.length > 1 && ` · ${timing.length} availability facts below`}</span></> : 'Not known yet'}</dd></div>
      <div><dt><Icon name="wallet" />Budgets</dt><dd>{budgets.length ? <>{budgets.slice(0, 2).map((fact) => <span className="overview-line" key={fact.id}>{subjectLabel(fact.subject, summary)}: {fact.amount === null ? 'Amount unknown' : `${fact.currency ?? 'Currency unknown'} ${fact.amount}`}</span>)}{budgets.length > 2 && <span className="overview-detail">+{budgets.length - 2} more below</span>}</> : 'Not known yet'}</dd></div>
      <div><dt><Icon name="chat" />Open questions</dt><dd>{open ? <>{open} open {open === 1 ? 'question' : 'questions'}</> : 'No questions recorded'}<span className="overview-detail">{summary.facts.some((fact) => fact.status === 'conflicting') ? 'Conflicting facts need attention' : 'Unknown is different from zero'}</span></dd></div></dl>
  </div>;
}
