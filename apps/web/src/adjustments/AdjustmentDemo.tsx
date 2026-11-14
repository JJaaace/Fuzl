import { useRef, useState } from 'react';
import { applyWorkChange, evaluateEvents, evaluatePlaces, makeWork, recordWorkDecision, workApplySchema, workCases, workFixture, workReportSchema } from '@fuzl/planning';
import type { WorkCase, WorkSuggestion } from '@fuzl/planning';
import MakeThisWork from './MakeThisWork';
import type { WorkTransport } from './MakeThisWork';
import PlaceCard from '../places/PlaceCard';
import EventCard from '../events/EventCard';
import SummaryReview from '../planning/SummaryReview';
export default function AdjustmentDemo() {
  const [kind, setKind] = useState<WorkCase>('time');
  return <main className="page"><h1>Make this work · synthetic local demo</h1><p>No account, API, database or provider request. These are hand-authored options and a simulated saved-session revision, not real recommendations. Changing cases resets this simulator.</p><label className="field"><span>Adjustment demo case</span><select value={kind} onChange={e => setKind(e.target.value as WorkCase)}>{workCases.map(k => <option key={k}>{k}</option>)}</select></label><Case key={kind} kind={kind}/></main>;
}
function Case({ kind }: { kind: WorkCase }) {
  const [fixture] = useState(() => workFixture(kind)), [summary, setSummary] = useState(fixture.summary), [context, setContext] = useState(fixture.context), [message, setMessage] = useState('');
  const [snapshot] = useState(() => crypto.randomUUID()), revision = useRef(0), serverGeneration = useRef(1);
  const previews = useRef(new Map<string, { key: string; generation: number; suggestions: WorkSuggestion[] }>());
  const result = context.kind === 'places' ? evaluatePlaces(context.candidates, context.area, context.query, summary, [], fixture.memories) : evaluateEvents(context.candidates, context.area, context.query, summary, [], fixture.memories);
  const transport: WorkTransport = async (path, raw) => {
    const input = raw as { summary: typeof summary; evidence: Parameters<typeof makeWork>[2] };
    const key = JSON.stringify([input.summary, input.evidence]);
    if (path === 'preview') { const report = makeWork(context, input.summary, input.evidence, fixture.memories), previewId = crypto.randomUUID(); previews.current.set(previewId, { key, generation: serverGeneration.current, suggestions: report.suggestions }); return workReportSchema.parse({ ...report, previewId }); }
    const chosen = workApplySchema.parse(raw), preview = previews.current.get(chosen.previewId), suggestion = preview?.suggestions.find(s => s.id === chosen.suggestionId);
    if (!preview || !suggestion || preview.key !== key || preview.generation !== serverGeneration.current) throw Error('Simulated saved revision or candidates changed. Current work was kept; preview again.');
    const next = applyWorkChange(context, summary, suggestion), decision = recordWorkDecision(summary, suggestion, crypto.randomUUID(), new Date().toISOString(), chosen.evidence); next.summary.organizerDecisions = [...(summary.organizerDecisions ?? []), decision];
    return { summary: next.summary, query: next.context.kind === 'places' ? next.context.query : null, decision };
  };
  return <><button onClick={() => { serverGeneration.current++; setMessage('Simulated external revision/candidate change. The existing preview must now fail server validation; your working summary is unchanged.'); }}>Simulate saved session or candidates changing elsewhere</button><p role="status">{message}</p><p>Evaluated options: {result.verified.length} checked fits. Source text and published plans remain unchanged by a preview.</p>
    {!result.verified.length && <MakeThisWork snapshotId={snapshot} summary={summary} getEditRevision={() => revision.current} transport={transport} onApply={(reply, at, expected) => { if (at !== revision.current || JSON.stringify(summary) !== expected) return false; revision.current++; setSummary(reply.summary); if (reply.query && context.kind === 'places') setContext({ ...context, query: reply.query }); setMessage('Adjustment applied to this simulated working session. Review the organizer decision and original source text below.'); return true; }}/>}
    {context.kind === 'places' ? [...result.verified, ...result.promising, ...result.excluded].map(r => 'candidate' in r ? <PlaceCard key={r.candidate.id} place={r}/> : null) : [...result.verified, ...result.promising, ...result.excluded].map(r => 'event' in r ? <EventCard key={r.event.id} result={r}/> : null)}
    <SummaryReview sourceKind="sample" summary={summary} onChange={next => { revision.current++; setSummary(next); }}/>
  </>;
}
