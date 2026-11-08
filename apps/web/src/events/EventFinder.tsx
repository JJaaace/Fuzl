import { useEffect, useRef, useState } from 'react';
import { demoEvents, evaluateEvents, eventQuerySchema, eventResponseSchema } from '@fuzl/planning';
import type { EventQuery, EventResponse, EventResults, PlaceQuery, PlanningSummary, SavedSession } from '@fuzl/planning';
import { privateRequest } from '../accounts/api';
import EventCard from './EventCard';
interface Props { active: boolean; query: PlaceQuery; onQuery: (query: PlaceQuery) => boolean | void; summary: PlanningSummary; loaded?: SavedSession; token?: string; previewOnly: boolean; getEditRevision: () => number }
export default function EventFinder({ active, query, onQuery, summary, loaded, token, previewOnly, getEditRevision }: Props) {
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [result, setResult] = useState<{ data: EventResults; fingerprint: string } | null>(null);
  const [clarification, setClarification] = useState<{ data: Extract<EventResponse, { kind: 'clarification' }>; fingerprint: string } | null>(null), [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [outdated, setOutdated] = useState(false);
  const pending = useRef<AbortController | null>(null), sequence = useRef(0), sending = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const key = (q: EventQuery) => JSON.stringify([q.area, q.radiusKm, q.resolutionId ?? null, q.from, q.to, summary, loaded?.id, loaded?.revision, token]);
  const eventQuery: EventQuery = { area: query.area, radiusKm: query.radiusKm, ...(query.resolutionId ? { resolutionId: query.resolutionId } : {}), from, to: to || from };
  const fingerprint = key(eventQuery), latest = useRef(fingerprint);
  useEffect(() => { latest.current = fingerprint; }, [fingerprint]);
  // Mounted while switching tabs so dates/drafts survive. Leaving cancels work;
  // a response can never switch the user's active discovery mode.
  useEffect(() => { if (!active) { pending.current?.abort(); sequence.current++; sending.current = false; } }, [active]);
  useEffect(() => () => { sequence.current++; pending.current?.abort(); }, []);
  async function search(mode: 'demo' | 'live', resolutionId?: string) {
    if (sending.current || !active) return;
    const q = resolutionId ? { ...eventQuery, resolutionId } : eventQuery;
    if (!eventQuerySchema.safeParse(q).success) { setError('Choose a valid US area, 1–30 km radius and explicit dates (up to 31 days). A blank end date means the same day. “Maybe Friday” needs a search date; your planning fact stays unchanged.'); return; }
    if (document.querySelector('.summary-panel .fact-form')) { setError('Apply or cancel open planning edits first.'); return; }
    if (mode === 'live' && (previewOnly || !loaded || !token)) return;
    if (resolutionId && onQuery({ ...query, resolutionId }) === false) { setError('Area change cancelled. Unsubmitted Places source fields were kept; no event search ran.'); return; }
    const snapshot = key(q), revision = getEditRevision(), serial = ++sequence.current;
    latest.current = snapshot; pending.current = new AbortController(); const controller = pending.current;
    controller.signal.addEventListener('abort', () => { if (serial === sequence.current) { sending.current = false; setBusy(false); } }, { once: true });
    sending.current = true; setBusy(true); setError(''); setOutdated(false); setResult(null); setClarification(null);
    try {
      let data: EventResponse;
      if (previewOnly) {
        const found = demoEvents(q, new Date().toISOString());
        data = 'choices' in found ? { kind: 'clarification', mode: 'demo', choices: found.choices, message: 'Choose the intended demo area. No provider request ran.' } : { mode: 'demo', area: found.area, query: q, retrievedAt: new Date().toISOString(), ...evaluateEvents(found.events, found.area, q, summary) };
      } else data = eventResponseSchema.parse(await privateRequest(token!, `/sessions/${loaded!.id}/events/search`, controller.signal, 'POST', { mode, sessionRevision: loaded!.revision, summary, query: q }));
      if (controller.signal.aborted || sequence.current !== serial) return;
      if (latest.current !== snapshot || getEditRevision() !== revision || document.querySelector('.summary-panel .fact-form')) { setOutdated(true); setError('Search dates, area or planning edits changed while waiting. The old response was not accepted. Search again.'); return; }
      if ('kind' in data) { setClarification({ data, fingerprint: snapshot }); setChoice(''); }
      else { setResult({ data, fingerprint: snapshot }); heading.current?.focus(); }
    } catch (failure) { if (!controller.signal.aborted && sequence.current === serial) setError(failure instanceof Error && failure.name !== 'ZodError' && !(failure instanceof SyntaxError) ? failure.message : 'Event results could not be verified. Your plan was kept; retry deliberately.'); }
    finally { if (sequence.current === serial) { sending.current = false; setBusy(false); } }
  }
  const stale = outdated || !!result && result.fingerprint !== fingerprint;
  const visible = result && !stale ? result.data : null;
  const card = (r: EventResults['promising'][number]) => <EventCard key={r.event.id} result={r} />;
  return <div hidden={!active} className="event-finder"><h4>Discover scheduled events</h4><p className="note">Choose specific search dates. These controls do not confirm availability or change tentative planning facts. Dates are inclusive and interpreted in each event’s local time. A blank end date searches one day.</p>
    <div className="form-grid"><label className="field"><span>Event search from</span><input type="date" value={from} onChange={e => { latest.current = ''; setFrom(e.target.value); }} /></label><label className="field"><span>Event search through (optional)</span><input type="date" min={from} value={to} onChange={e => { latest.current = ''; setTo(e.target.value); }} /></label></div>
    <p className="provider-disclosure">Demo events are hand-authored fixtures; no provider request. Live search sends only area/choice to Geoapify, then the resolved center, radius and dates to Ticketmaster. Conversations, participant details and budgets stay out of both providers’ requests. Private comparisons stay on Fuzl’s server. No automatic retries or paid fallback.</p>
    <div className="places-actions"><button disabled={busy} onClick={() => void search('demo')}>Show demo events</button>{!previewOnly && <button className="primary" disabled={busy} onClick={() => void search('live')}>Search real events</button>}{busy && <button onClick={() => { sequence.current++; pending.current?.abort(); sending.current = false; setBusy(false); setError('Event search cancelled. Your plan was kept.'); }}>Cancel event search</button>}</div>
    {busy && <p role="status">Looking for scheduled events…</p>}{error && <p role="alert" className="validation-error">{error}</p>}{stale && <p role="status" className="notice">Previous event results are out of date and hidden. Review dates, radius and planning edits, then search again.</p>}
    {clarification && clarification.fingerprint === fingerprint && <section aria-label="Choose event search area"><h4>Which area did you mean?</h4><p>{clarification.data.message}</p><label className="field"><span>Event area choices</span><select value={choice} onChange={e => setChoice(e.target.value)}><option value="">Choose an area</option>{clarification.data.choices.map(a => <option key={a.id} value={a.id}>{a.label} · {a.timeZone ?? 'zone unknown'}</option>)}</select></label><button disabled={busy || !choice} onClick={() => void search(clarification.data.mode, choice)}>Search events in selected area</button></section>}
    <h3 ref={heading} tabIndex={-1}>{visible ? visible.mode === 'demo' ? 'Demo events — synthetic' : 'Events to consider' : 'Your event shortlist'}</h3>
    {visible && <><p className="note">Resolved area: {visible.area.label} · {visible.query.from} through {visible.query.to} · {visible.query.radiusKm} km radius · Retrieved {new Date(visible.retrievedAt).toLocaleString()}</p>
      <h4>Fits the checked constraints</h4>{!visible.verified.length && <p>No returned event fits all checked constraints. Your firm limits were kept.</p>}{visible.verified.map(card)}
      {!!visible.promising.length && <><h4>Promising — needs checking</h4>{visible.promising.map(card)}</>}
      {visible.verified.length + visible.promising.length < 3 && <section className="notice"><strong>{visible.verified.length + visible.promising.length === 0 ? 'No useful events for these filters.' : 'Fewer than three useful events returned.'}</strong><p>Change the search dates above or widen the radius deliberately. Firm planning constraints stay unchanged. Coverage is limited to this provider’s returned page.</p><button onClick={() => document.querySelector<HTMLInputElement>('.event-finder input[type="date"]')?.focus()}>Change event dates</button><button disabled={query.radiusKm >= 30} onClick={() => onQuery({ ...query, radiusKm: Math.min(30, query.radiusKm + 5) })}>Widen event radius by 5 km (search when ready)</button></section>}
      {!!visible.excluded.length && <details><summary>Excluded events ({visible.excluded.length})</summary>{visible.excluded.map(card)}</details>}
      <ul className="note">{visible.notices.map(n => <li key={n}>{n}</li>)}</ul>
      {visible.mode === 'live' && <p className="places-attribution">Event data: <a href="https://www.ticketmaster.com/" target="_blank" rel="noreferrer">Ticketmaster</a>. Area: <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors (ODbL)</a>. Specific event links open external ticket listings; their privacy policies apply. Fuzl keeps this shortlist temporarily in memory.</p>}
    </>}
  </div>;
}
