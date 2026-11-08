import { useEffect, useRef, useState } from 'react';
import { demoPlaces, evaluatePlaces, factValue, placeCategories, placeQuerySchema, placeResultsSchema } from '@fuzl/planning';
import type { PlaceQuery, PlaceResults, PlanningSummary, SavedSession, PlaceSearch } from '@fuzl/planning';
import { privateRequest } from '../accounts/api';
import PlaceCard from './PlaceCard';
import ManualPlace from './ManualPlace';
export interface FinderProps { token?: string; loaded?: SavedSession; summary: PlanningSummary; getEditRevision: () => number; initialQuery?: PlaceQuery; previewOnly?: boolean }
const initial: PlaceQuery = { area: '', radiusKm: 5, category: 'any', date: null, start: null, end: null, timeZone: null };
export default function PlaceFinder({ token, loaded, summary, getEditRevision, initialQuery = initial, previewOnly = false }: FinderProps) {
  const [open, setOpen] = useState(previewOnly);
  const [query, setQuery] = useState<PlaceQuery>(initialQuery);
  const [manual, setManual] = useState<PlaceSearch['manual']>([]);
  const [result, setResult] = useState<{ data: PlaceResults; fingerprint: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [outdated, setOutdated] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const sequence = useRef(0), sending = useRef(false);
  const fingerprint = JSON.stringify([query, manual, summary, loaded?.revision]);
  const latest = useRef(fingerprint);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { latest.current = fingerprint; }, [fingerprint]);
  useEffect(() => () => { sequence.current++; pending.current?.abort(); }, []);
  async function search(mode: 'demo' | 'live') {
    if (sending.current) return;
    if (!placeQuerySchema.safeParse(query).success) { setError('Enter a City, State or five-digit US ZIP, 1–30 km radius and valid timing. End must follow start; leave uncertain timing blank.'); return; }
    if (document.querySelector('.summary-panel .fact-form')) { setError('Apply or cancel open planning editors first. Unapplied edits were kept.'); return; }
    if (mode === 'live' && (previewOnly || !token || !loaded)) return;
    const controller = new AbortController(); pending.current = controller;
    const serial = ++sequence.current, snapshot = fingerprint, revision = getEditRevision();
    sending.current = true; setBusy(true); setError(''); setOutdated(false);
    try {
      let data: PlaceResults;
      if (previewOnly) {
        const found = demoPlaces(query, new Date().toISOString());
        data = placeResultsSchema.parse({ mode: 'demo', retrievedAt: new Date().toISOString(), ...evaluatePlaces([...found.candidates, ...manual.map((v, i) => ({ ...v, source: 'organizer' as const, id: `manual-${i}`, retrievedAt: new Date().toISOString() }))], found.area, query, summary) });
      } else {
        const payload: PlaceSearch = { mode, sessionRevision: loaded!.revision, summary, query, manual };
        data = placeResultsSchema.parse(await privateRequest(token!, `/sessions/${loaded!.id}/places/search`, controller.signal, 'POST', payload));
      }
      if (controller.signal.aborted || serial !== sequence.current) return;
      if (latest.current !== snapshot || getEditRevision() !== revision || document.querySelector('.summary-panel .fact-form')) { setOutdated(true); setError('Search inputs or planning edits changed while waiting. Search again; the old response was not accepted.'); return; }
      setResult({ data, fingerprint: snapshot }); heading.current?.focus();
    } catch (failure) {
      if (!controller.signal.aborted && serial === sequence.current) setError(failure instanceof Error && !(failure instanceof SyntaxError) && failure.name !== 'ZodError' ? failure.message : 'The search response could not be verified. Your summary was kept; retry deliberately.');
    } finally { if (serial === sequence.current) { sending.current = false; setBusy(false); } }
  }
  function change(next: PlaceQuery) { setQuery(next); }
  const stale = outdated || !!result && result.fingerprint !== fingerprint;
  const visible = result && !stale ? result.data : null;
  return <section className="place-finder review-section">
    {!previewOnly && <button aria-expanded={open} onClick={() => setOpen(v => !v)}>Find places</button>}
    <div hidden={!open}><h3>Find a place for this plan</h3><p className="note">Use your applied planning facts and guest answers. Unreviewed AI claims stay unreviewed. These are suggestions, never a booking or confirmed plan. Search results and manual candidates are temporary; Save session does not save this shortlist.</p>
      <details><summary>Planning facts used for checking</summary><ul>{summary.facts.filter(f => f.extraction?.scope !== 'historical').map(f => <li key={f.id}>{factValue(f)} · {f.strength} · {f.status}{f.extraction && !f.extraction.reviewed && <strong> · AI claim — unreviewed</strong>}{f.guest && ' · Applied guest answer'}</li>)}</ul><p className="note">Only confirmed, reviewed, attributed firm facts can verify or exclude. Tentative, conflicting, unknown-firmness or unreviewed information stays unresolved. Flexible preferences affect ordering. Free-text requirements may need manual checking.</p></details>
      <div className="form-grid"><label className="field"><span>Search area (US City, State or ZIP)</span><input maxLength={100} placeholder="Columbus, OH or 43210" value={query.area} onChange={e => change({ ...query, area: e.target.value })}/></label><label className="field"><span>Search radius in km</span><input type="number" min="1" max="30" step="1" value={query.radiusKm} onChange={e => change({ ...query, radiusKm: Number(e.target.value) })}/></label><label className="field"><span>Category</span><select value={query.category} onChange={e => change({ ...query, category: e.target.value as PlaceQuery['category'] })}>{placeCategories.map(c => <option key={c} value={c}>{c === 'any' ? 'All supported activities' : c}</option>)}</select></label></div>
      <details><summary>Outing timing (optional; unknown stays unchecked)</summary><p className="note">Use a specific date, start/end and IANA time zone. “Friday” remains unresolved until you correct the planning fact. These controls do not rewrite the summary. Radius measures a boundary around the area center, not travel time from anyone’s home.</p><div className="form-grid">{(['date', 'start', 'end', 'timeZone'] as const).map(k => <label className="field" key={k}><span>{k === 'timeZone' ? 'Time zone (e.g. America/New_York)' : k === 'date' ? 'Outing date' : k === 'start' ? 'Start time' : 'End time'}</span><input type={k === 'date' ? 'date' : k === 'timeZone' ? 'text' : 'time'} maxLength={80} value={query[k] ?? ''} onChange={e => change({ ...query, [k]: e.target.value || null })}/></label>)}</div></details>
      <ManualPlace onAdd={candidate => setManual(v => [...v, candidate])} disabled={manual.length >= 3} />
      {!!manual.length && <ul>{manual.map((m, i) => <li key={i}>{m.name} · Organizer-entered details <button className="quiet" onClick={() => setManual(v => v.filter((_, index) => index !== i))}>Remove {m.name}</button></li>)}</ul>}
      <p className="provider-disclosure">Demo results use synthetic fixtures and make no provider request. Live search sends only the area, radius and category to Geoapify. Names, chats, images, dates and individual budgets stay out of its requests. Live search requires backend Free-plan configuration.</p>
      <div className="places-actions"><button disabled={busy} onClick={() => void search('demo')}>Show demo results</button>{!previewOnly && <button className="primary" disabled={busy} onClick={() => void search('live')}>Search real places</button>}{busy && <button onClick={() => { sequence.current++; pending.current?.abort(); sending.current = false; setBusy(false); setError('Search cancelled. Your planning summary was kept.'); }}>Cancel search</button>}</div>
      {busy && <p role="status">Looking for places…</p>}{error && <p role="alert" className="validation-error">{error}</p>}{stale && <p role="status" className="notice">Previous results are out of date and hidden. Review your changes, then search again.</p>}
      <h3 ref={heading} tabIndex={-1}>{visible ? visible.mode === 'demo' ? 'Demo results' : 'Places to consider' : 'Your shortlist'}</h3>
      {visible && <><p className="note">{visible.area.label} · Retrieved {new Date(visible.retrievedAt).toLocaleString()}{visible.mode === 'demo' && ' · Synthetic venues and details, not real recommendations'}</p>
        <h4>Fits the verified constraints</h4>{!visible.verified.length && <p>No returned option is verified to fit all checked constraints. Your limits were kept.</p>}{visible.verified.map(r => <PlaceCard key={r.candidate.id} place={r} />)}
        {!!visible.promising.length && <><h4>Promising — needs checking</h4>{visible.promising.map(r => <PlaceCard key={r.candidate.id} place={r} />)}</>}
        {!visible.verified.length && !visible.promising.length && <p>No useful options returned for these filters. Review the exclusions or try another area/category without changing firm limits.</p>}
        {!!visible.excluded.length && <details><summary>Doesn’t fit ({visible.excluded.length})</summary>{visible.excluded.map(r => <PlaceCard key={r.candidate.id} place={r} />)}</details>}
        <ul className="note">{visible.notices.map(n => <li key={n}>{n}</li>)}</ul>{visible.mode === 'live' && <p className="places-attribution">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors (ODbL)</a></p>}
      </>}
    </div>
  </section>;
}
