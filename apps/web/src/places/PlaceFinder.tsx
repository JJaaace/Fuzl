import { useEffect, useRef, useState } from 'react';
import { demoPlaces, evaluatePlaces, factValue, placeCategories, placeQuerySchema, placeResponseSchema, manualPlaces, correctedPlace } from '@fuzl/planning';
import type { PlaceQuery, PlaceResults, PlanningSummary, SavedSession, PlaceSearch, PlaceCorrection, PlaceResponse, PlaceDiscovery } from '@fuzl/planning';
import { privateRequest, SavedWorkError } from '../accounts/api';
import PlaceCard from './PlaceCard';
import ManualPlace from './ManualPlace';
export interface FinderProps { token?: string; loaded?: SavedSession; summary: PlanningSummary; getEditRevision: () => number; initialQuery?: PlaceQuery; previewOnly?: boolean }
const initial: PlaceQuery = { area: '', radiusKm: 5, category: 'any', date: null, start: null, end: null, timeZone: null };
export default function PlaceFinder({ token, loaded, summary, getEditRevision, initialQuery = initial, previewOnly = false }: FinderProps) {
  const [open, setOpen] = useState(previewOnly);
  const [query, setQuery] = useState<PlaceQuery>(initialQuery);
  const [manual, setManual] = useState<PlaceSearch['manual']>([]);
  const [corrections, setCorrections] = useState<PlaceCorrection[]>([]);
  const [clarification, setClarification] = useState<{ data: Extract<PlaceResponse, { kind: 'clarification' }>; fingerprint: string } | null>(null);
  const [choice, setChoice] = useState('');
  const previewCache = useRef<{ found: Exclude<PlaceDiscovery, { choices: unknown }>; boundary: string } | null>(null);
  const [result, setResult] = useState<{ data: PlaceResults; fingerprint: string; boundary: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [outdated, setOutdated] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const sequence = useRef(0), sending = useRef(false);
  const fingerprintFor = (q: PlaceQuery, m = manual, c = corrections) => JSON.stringify([q, m, c, summary, loaded?.revision]);
  const fingerprint = fingerprintFor(query);
  const boundary = (q: PlaceQuery) => JSON.stringify([q.area, q.resolutionId ?? null, q.radiusKm, q.category]);
  const latest = useRef(fingerprint);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { latest.current = fingerprint; }, [fingerprint]);
  useEffect(() => () => { sequence.current++; pending.current?.abort(); }, []);
  function allowDraftReplacement(exceptVenue?: string) {
    const unsent = [...document.querySelectorAll<HTMLElement>('.place-evidence-editor[data-places-dirty="true"]')].some(node => node.dataset.venue !== exceptVenue);
    return !unsent || window.confirm('This will replace unsubmitted source fields. Recorded details and the planning summary stay. Continue?');
  }
  async function search(mode: 'demo' | 'live', resolutionId?: string, recheck = false, nextCorrections = corrections, exceptVenue?: string) {
    if (sending.current || !allowDraftReplacement(exceptVenue)) return;
    const activeQuery = resolutionId ? { ...query, resolutionId } : query;
    if (!placeQuerySchema.safeParse(activeQuery).success) { setError('Invalid location or timing: use a five-digit US ZIP, or a city with an optional valid state, 1–30 km radius and a valid window.'); return; }
    if (document.querySelector('.summary-panel .fact-form')) { setError('Apply or cancel open planning editors first. Unapplied edits were kept.'); return; }
    if (mode === 'live' && (previewOnly || !token || !loaded)) return;
    if (resolutionId) setQuery(activeQuery);
    const controller = new AbortController(); pending.current = controller;
    const serial = ++sequence.current, snapshot = fingerprintFor(activeQuery, manual, nextCorrections), revision = getEditRevision();
    latest.current = snapshot;
    sending.current = true; setBusy(true); setError(''); setOutdated(false);
    try {
      let data: PlaceResponse;
      if (previewOnly) {
        const found = recheck ? previewCache.current?.found : demoPlaces(activeQuery, new Date().toISOString());
        if (!found || recheck && previewCache.current?.boundary !== boundary(activeQuery)) throw Error('Search the current area before rechecking these places. Recorded details were kept.');
        if ('choices' in found) data = { kind: 'clarification', mode: 'demo', choices: found.choices, message: 'Choose a demo Springfield or add a state. No location was silently selected.' };
        else {
          previewCache.current = { found, boundary: boundary(activeQuery) };
          const candidates = [...found.candidates, ...manualPlaces(manual, new Date().toISOString())].map(c => correctedPlace(c, nextCorrections));
          data = { mode: 'demo', coverage: found.candidates.length === 0 ? 'empty' : found.candidates.length < 3 ? 'sparse' : 'available', retrievedAt: new Date().toISOString(), ...evaluatePlaces(candidates, found.area, activeQuery, summary) };
        }
      } else {
        if (recheck && !result?.data.searchId) throw Error('Run a search before rechecking recorded details.');
        const payload = { mode, sessionRevision: loaded!.revision, summary, query: activeQuery, manual, corrections: nextCorrections, ...(recheck ? { searchId: result!.data.searchId } : {}) };
        data = placeResponseSchema.parse(await privateRequest(token!, `/sessions/${loaded!.id}/places/${recheck ? 'evaluate' : 'search'}`, controller.signal, 'POST', payload));
      }
      if (controller.signal.aborted || serial !== sequence.current) return;
      if (latest.current !== snapshot || getEditRevision() !== revision || document.querySelector('.summary-panel .fact-form')) { setOutdated(true); setError('Search inputs or planning edits changed while waiting. Search again; the old response was not accepted.'); return; }
      if ('kind' in data) { setClarification({ data, fingerprint: snapshot }); setChoice(''); setResult(null); }
      else { setResult({ data, fingerprint: snapshot, boundary: boundary(activeQuery) }); setClarification(null); heading.current?.focus(); }
    } catch (failure) {
      if (!controller.signal.aborted && serial === sequence.current) setError(failure instanceof SavedWorkError && failure.code === 'area_not_found' ? `Location not found: ${failure.message}` : failure instanceof Error && !(failure instanceof SyntaxError) && failure.name !== 'ZodError' ? failure.message : 'The search response could not be verified. Your summary was kept; retry deliberately.');
    } finally { if (serial === sequence.current) { sending.current = false; setBusy(false); } }
  }
  function change(next: PlaceQuery) { if (!allowDraftReplacement()) return; const updated = next.area !== query.area ? { ...next, resolutionId: undefined } : next; latest.current = fingerprintFor(updated); setQuery(updated); }
  function review(correction: PlaceCorrection) {
    const key = `${correction.candidateSource}:${correction.candidateId}`;
    if (sending.current || !allowDraftReplacement(key)) return false;
    const next = [...corrections.filter(v => v.candidateId !== correction.candidateId || v.candidateSource !== correction.candidateSource), correction];
    if (next.length > 23) { setError('The temporary detail limit is reached. Clear recorded details before adding another place.'); return false; }
    latest.current = fingerprintFor(query, manual, next); setCorrections(next); void search(result?.data.mode ?? 'demo', undefined, true, next, key); return true;
  }
  const card = (r: PlaceResults['promising'][number]) => <PlaceCard key={r.candidate.id} place={r} busy={busy} onReview={review} />;
  const stale = outdated || !!result && result.fingerprint !== fingerprint;
  const visible = result && !stale ? result.data : null;
  return <section className="place-finder review-section">
    {!previewOnly && <button aria-expanded={open} onClick={() => setOpen(v => !v)}>Find places</button>}
    <div hidden={!open}><h3>Find a place for this plan</h3><p className="note">Use your applied planning facts and guest answers. Unreviewed AI claims stay unreviewed. These are suggestions, never a booking or confirmed plan. Search results and manual candidates are temporary; Save session does not save this shortlist.</p>
      <details><summary>Planning facts used for checking</summary><ul>{summary.facts.filter(f => f.extraction?.scope !== 'historical').map(f => <li key={f.id}>{factValue(f)} · {f.strength} · {f.status}{f.extraction && !f.extraction.reviewed && <strong> · AI claim — unreviewed</strong>}{f.guest && ' · Applied guest answer'}</li>)}</ul><p className="note">Only confirmed, reviewed, attributed firm facts can verify or exclude. Tentative, conflicting, unknown-firmness or unreviewed information stays unresolved. Flexible preferences affect ordering. Free-text requirements may need manual checking.</p></details>
      <div className="form-grid"><label className="field"><span>Search area (US City, State or ZIP)</span><input maxLength={100} placeholder="Columbus, OH or 43210" value={query.area} onChange={e => change({ ...query, area: e.target.value })}/></label><label className="field"><span>Search radius in km</span><input type="number" min="1" max="30" step="1" value={query.radiusKm} onChange={e => change({ ...query, radiusKm: Number(e.target.value) })}/></label><label className="field"><span>Category</span><select value={query.category} onChange={e => change({ ...query, category: e.target.value as PlaceQuery['category'] })}>{placeCategories.map(c => <option key={c} value={c}>{c === 'any' ? 'All supported activities' : c}</option>)}</select></label></div>
      <details><summary>Outing timing (optional; unknown stays unchecked)</summary><p className="note">Use a specific date, start/end and IANA time zone; a blank zone uses the matched venue’s reliable local zone when available. Ambiguous DST clocks stay unresolved. “Friday” remains unresolved until you correct the planning fact. These controls do not rewrite the summary. Radius measures a boundary around the area center, not travel time from anyone’s home.</p><div className="form-grid">{(['date', 'start', 'end', 'timeZone'] as const).map(k => <label className="field" key={k}><span>{k === 'timeZone' ? 'Time zone (e.g. America/New_York)' : k === 'date' ? 'Outing date' : k === 'start' ? 'Start time' : 'End time'}</span><input type={k === 'date' ? 'date' : k === 'timeZone' ? 'text' : 'time'} maxLength={80} value={query[k] ?? ''} onChange={e => change({ ...query, [k]: e.target.value || null })}/></label>)}</div></details>
      <ManualPlace onAdd={candidate => { if (!allowDraftReplacement()) return false; const next = [...manual, { ...candidate, manualId: crypto.randomUUID() }]; latest.current = fingerprintFor(query, next); setManual(next); return true; }} disabled={manual.length >= 3} />
      {!!manual.length && <ul>{manual.map((m, i) => <li key={i}>{m.name} · Organizer-entered details <button className="quiet" onClick={() => { if (!allowDraftReplacement()) return; const next = manual.filter((_, index) => index !== i); latest.current = fingerprintFor(query, next); setManual(next); }}>Remove {m.name}</button></li>)}</ul>}
      <p className="provider-disclosure">Demo results use synthetic fixtures and make no provider request. Recording/rechecking details does not call a provider. Live search sends only the area, explicit area choice, radius and category to Geoapify. Names, chats, images, dates and individual budgets stay out of its requests. Live search requires backend Free-plan configuration.</p>
      <div className="places-actions">{result && <button disabled={busy || result.boundary !== boundary(query)} onClick={() => void search(result.data.mode, undefined, true)}>Recheck current places (no provider call)</button>}<button disabled={busy} onClick={() => void search('demo')}>Show demo results</button>{!previewOnly && <button className="primary" disabled={busy} onClick={() => void search('live')}>Search real places</button>}{busy && <button onClick={() => { sequence.current++; pending.current?.abort(); sending.current = false; setBusy(false); setError('Search cancelled. Your planning summary was kept.'); }}>Cancel search</button>}</div>
      {busy && <p role="status">Looking for places…</p>}{error && <p role="alert" className="validation-error">{error}</p>}{stale && <p role="status" className="notice">Previous results are out of date and hidden. Review your changes, then search again.</p>}
      {clarification && clarification.fingerprint === fingerprint && <section className="area-clarification" aria-label="Choose resolved area"><h4>Which area did you mean?</h4><p>{clarification.data.message}</p><label className="field"><span>Resolved area choices</span><select value={choice} onChange={e => setChoice(e.target.value)}><option value="">Choose an area</option>{clarification.data.choices.map(area => <option key={area.id} value={area.id}>{area.label} · {area.lat.toFixed(3)}, {area.lon.toFixed(3)} · {area.timeZone ?? 'zone unknown'}</option>)}</select></label><button disabled={busy || !choice} onClick={() => void search(clarification.data.mode, choice)}>Search selected area</button></section>}
      <h3 ref={heading} tabIndex={-1}>{visible ? visible.mode === 'demo' ? 'Demo results' : 'Places to consider' : 'Your shortlist'}</h3>
      {visible && <>{(visible.coverage === 'empty' || visible.coverage === 'sparse') && <section className="notice"><strong>{visible.coverage === 'empty' ? 'No venue listings returned for these filters.' : 'Sparse coverage: fewer than three venue listings returned.'}</strong><p>Try a different radius or category deliberately. Firm planning constraints stay unchanged.</p><button disabled={busy || query.radiusKm >= 30} onClick={() => change({ ...query, radiusKm: Math.min(30, query.radiusKm + 5) })}>Increase radius by 5 km (search when ready)</button><button disabled={busy || query.category === 'any'} onClick={() => change({ ...query, category: 'any' })}>Show all categories (search when ready)</button></section>}<p className="note">Resolved area: {visible.area.label} · Retrieved {new Date(visible.retrievedAt).toLocaleString()}{visible.mode === 'demo' && ' · Synthetic venues and details, not real recommendations'}</p>
        <h4>Fits the verified constraints</h4>{!visible.verified.length && <p>No returned option is verified to fit all checked constraints. Your limits were kept.</p>}{visible.verified.map(card)}
        {!!visible.promising.length && <><h4>Promising — needs checking</h4>{visible.promising.map(card)}</>}
        {!visible.verified.length && !visible.promising.length && <p>No useful options returned for these filters. Review the exclusions or try another area/category without changing firm limits.</p>}
        {!!visible.excluded.length && <details><summary>Doesn’t fit ({visible.excluded.length})</summary>{visible.excluded.map(card)}</details>}
        <ul className="note">{visible.notices.map(n => <li key={n}>{n}</li>)}</ul>{visible.mode === 'live' && <p className="places-attribution">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors (ODbL)</a></p>}
      </>}
    </div>
  </section>;
}
