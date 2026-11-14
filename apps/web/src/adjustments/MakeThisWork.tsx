import { useEffect, useRef, useState } from 'react';
import { visitEvidenceSchema, workApplyReplySchema, workReportSchema } from '@fuzl/planning';
import type { PlanningSummary, SavedSession, VisitWindow, WorkApplyReply, WorkEvidence, WorkReport } from '@fuzl/planning';
import { privateRequest } from '../accounts/api';

export type ApplyAdjustment = (reply: WorkApplyReply, editRevision: number, expectedSummary: string) => boolean;
export type WorkTransport = (path: 'preview' | 'apply', body: unknown, signal: AbortSignal) => Promise<unknown>;
const empty = { key: '', travel: false, booking: false, minutes: '', mode: 'driving', origin: '', common: false, date: '', arrival: '', zone: '', travelSource: '', checked: '', bookingState: 'not-required', start: '', end: '', bookingSource: '' };
export default function MakeThisWork({ snapshotId, token, loaded, summary, getEditRevision, onApply, active = true, window: windowHint, transport }: { snapshotId?: string; token?: string; loaded?: SavedSession; summary: PlanningSummary; getEditRevision: () => number; onApply?: ApplyAdjustment; active?: boolean; window?: VisitWindow; transport?: WorkTransport }) {
  const [report, setReport] = useState<WorkReport | null>(null), [evidence, setEvidence] = useState<WorkEvidence>([]), [fields, setFields] = useState(empty), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [approved, setApproved] = useState(''), [sourceDirty, setSourceDirty] = useState(false), [previewKey, setPreviewKey] = useState('');
  const serial = useRef(0), edit = useRef(0), sending = useRef(false), pending = useRef<AbortController | null>(null), current = useRef(''), preview = useRef<{ key: string; editRevision: number } | null>(null);
  const key = JSON.stringify([snapshotId, summary, loaded?.id, loaded?.revision, evidence, active]);
  useEffect(() => { current.current = key; }, [key]);
  useEffect(() => () => { serial.current++; pending.current?.abort(); }, []);
  useEffect(() => { if (!active) pending.current?.abort(); }, [active]);
  const request: WorkTransport = transport ?? ((path, body, signal) => privateRequest(token!, `/sessions/${loaded!.id}/adjustments/${path}`, signal, 'POST', body));
  function invalidate() { edit.current++; setPreviewKey(''); setApproved(''); preview.current = null; }
  async function run(path: 'preview' | 'apply', suggestionId?: string) {
    if (sending.current || !active || !snapshotId || !transport && (!token || !loaded)) return;
    if (document.querySelector('.summary-panel .fact-form')) { setMessage('Apply or cancel open planning editors first; their entries were kept.'); return; }
    if (sourceDirty) { setMessage('Record the unfinished sourced checks or clear them before preview/apply.'); return; }
    const revision = getEditRevision(), at = edit.current, fingerprint = key, expected = JSON.stringify(summary);
    if (path === 'apply' && (preview.current?.key !== key || preview.current.editRevision !== revision || approved !== suggestionId)) { setMessage('The preview is stale or not approved. Your edits were kept; preview again.'); return; }
    const n = ++serial.current; sending.current = true; setBusy(true); setMessage(''); const c = new AbortController(); pending.current = c;
    c.signal.addEventListener('abort', () => { if (n === serial.current) { serial.current++; sending.current = false; setBusy(false); } }, { once: true });
    try {
      const input = { snapshotId, sessionRevision: loaded?.revision ?? 1, summary, evidence };
      const raw = await request(path, path === 'preview' ? input : { ...input, previewId: report!.previewId, suggestionId, approved: true }, c.signal);
      if (c.signal.aborted || n !== serial.current || current.current !== fingerprint || at !== edit.current || revision !== getEditRevision() || document.querySelector('.summary-panel .fact-form')) { setMessage('Inputs changed while waiting. The old response was not applied; preview current options again.'); return; }
      if (path === 'preview') { setReport(workReportSchema.parse(raw)); setPreviewKey(fingerprint); preview.current = { key: fingerprint, editRevision: revision }; setApproved(''); }
      else {
        const reply = workApplyReplySchema.parse(raw);
        if (!onApply || !onApply(reply, revision, expected)) throw Error('The working session changed. No newer edits were overwritten.');
        invalidate(); setMessage('Applied to the working session as an organizer decision. Save session explicitly to keep it. Published plans and RSVPs are unchanged.');
      }
    } catch (e) { if (!c.signal.aborted) setMessage(e instanceof Error && e.name !== 'ZodError' ? e.message : 'The adjustment response could not be verified. Your work was kept.'); }
    finally { if (n === serial.current) { sending.current = false; if (!c.signal.aborted) setBusy(false); } }
  }
  function recordEvidence() {
    const option = report?.options.find(o => o.key === fields.key);
    if (!option?.destination) { setMessage('Select an option with a known destination address first. Unresolved address checks still apply.'); return; }
    const common = { destination: option.destination, date: fields.date, timeZone: fields.zone, checkedOn: fields.checked };
    const parsed = visitEvidenceSchema.safeParse({ ...(fields.travel ? { travel: { ...common, minutes: fields.minutes === '' ? null : Number(fields.minutes), mode: fields.mode, origin: fields.origin, commonOriginConfirmed: fields.common, arrival: fields.arrival, sourceUrl: fields.travelSource } } : {}), ...(fields.booking ? { booking: { ...common, state: fields.bookingState, start: fields.start, end: fields.end, sourceUrl: fields.bookingSource } } : {}) });
    if (!parsed.success || !fields.travel && !fields.booking) { setMessage('Check the sourced details, date, clock/zone, source/check date and explicit shared-origin confirmation. Blank travel time is unknown, not zero.'); return; }
    const next = [...evidence.filter(e => e.key !== fields.key), { key: fields.key, evidence: parsed.data }];
    if (next.length > 3) { setMessage('Record checks for at most three options. Clear a check before adding another.'); return; }
    invalidate(); setSourceDirty(false); setEvidence(next); setMessage('Sourced checks recorded temporarily. Choose Make this work again to evaluate; they are saved only with an explicitly applied decision.');
  }
  return <section className="make-work review-section" data-venue="work-evidence" data-places-dirty={sourceDirty || evidence.length ? 'true' : 'false'} data-plan-dirty={sourceDirty || evidence.length ? 'true' : 'false'}><h4>Make this work</h4><p>Test one explicitly flexible group window or travel bound against these existing options. No new search or provider request. Firm constraints stay in force; a shift never changes a provider’s event schedule.</p>
    <button disabled={busy || !active || !snapshotId} onClick={() => void run('preview')}>{busy ? 'Checking adjustments…' : 'Make this work'}</button>
    {!snapshotId && <p className="note">Run a current search first. This preview needs a server-bound candidate snapshot.</p>}
    {report && <><p className="notice" role="status">{report.message}</p>{(previewKey === key && !sourceDirty ? report.suggestions : []).map(s => <article className="ballot-preview" key={s.id}><h4>{s.kind === 'start-time' ? 'Move the outing window' : 'Adjust flexible travel'}</h4><p><strong>Original:</strong> {s.before}<br/><strong>Suggested:</strong> {s.after}</p><p>{s.fits} option{s.fits === 1 ? '' : 's'} fit · {s.stillNeedsChecking} still need checking</p><p>{s.explanation}</p><ul>{s.affected.map(o => <li key={o.key}><strong>{o.name} · {o.state === 'fits' ? 'Fits the supplied checks' : 'Still needs checking'}</strong><ul>{o.remaining.map((r, i) => <li key={i}>{r}</li>)}</ul></li>)}</ul><label className="check-label"><input type="checkbox" checked={approved === s.id} onChange={e => setApproved(e.target.checked ? s.id : '')}/>I approve this single change to the working session and understand any remaining checks. It does not revise a published plan.</label><button disabled={busy || !onApply || approved !== s.id} onClick={() => void run('apply', s.id)}>Apply this adjustment</button></article>)}</>}
    {report?.options.length ? <details><summary>Confirm a missing travel or booking detail</summary><p className="note">Only record sourced checks for the exact option/date/window. A shared-origin travel estimate must actually apply to everyone; it is not inferred from radius, addresses or names. These details stay in the organizer’s working session.</p><fieldset disabled={busy} onChange={() => { invalidate(); setSourceDirty(true); }}><legend>Sourced option checks (up to three)</legend><label className="field"><span>Option to check</span><select value={fields.key} onChange={e => { const o = report.options.find(o => o.key === e.target.value); setFields({ ...empty, key: o?.key ?? '', date: windowHint?.date ?? '', arrival: windowHint?.start ?? '', start: windowHint?.start ?? '', end: windowHint?.end ?? '', zone: windowHint?.timeZone ?? '', checked: new Date().toISOString().slice(0, 10) }); }}><option value="">Choose an option</option>{report.options.map(o => <option key={o.key} value={o.key}>{o.name}{!o.destination ? ' · Address needs checking' : ''}</option>)}</select></label>
      <div className="form-grid">{(['date', 'zone', 'checked'] as const).map(f => <label className="field" key={f}><span>{f === 'date' ? 'Check applies to outing date' : f === 'zone' ? 'Evidence time zone' : 'Source checked on'}</span><input type={f === 'zone' ? 'text' : 'date'} value={fields[f]} onChange={e => { setFields({ ...fields, [f]: e.target.value }); }}/></label>)}</div>
      <label className="check-label"><input type="checkbox" checked={fields.travel} onChange={e => setFields({ ...fields, travel: e.target.checked })}/>Record a sourced travel-time estimate</label>
      {fields.travel && <><div className="form-grid">{(['minutes', 'origin', 'arrival', 'travelSource'] as const).map(f => <label className="field" key={f}><span>{({ minutes: 'Estimated travel minutes', origin: 'Shared departure point (no private home address)', arrival: 'Estimate arrival time', travelSource: 'Travel estimate source URL' })[f]}</span><input type={f === 'minutes' ? 'number' : f === 'arrival' ? 'time' : f === 'travelSource' ? 'url' : 'text'} min={0} max={480} maxLength={f === 'travelSource' ? 1000 : 160} value={fields[f]} onChange={e => setFields({ ...fields, [f]: e.target.value })}/></label>)}<label className="field"><span>Travel estimate mode</span><select value={fields.mode} onChange={e => setFields({ ...fields, mode: e.target.value })}>{['driving', 'walking', 'cycling', 'transit'].map(m => <option key={m}>{m}</option>)}</select></label></div><label className="check-label"><input type="checkbox" checked={fields.common} onChange={e => setFields({ ...fields, common: e.target.checked })}/>Everyone’s relevant journey uses this shared departure point and mode.</label></>}
      <label className="check-label"><input type="checkbox" checked={fields.booking} onChange={e => setFields({ ...fields, booking: e.target.checked })}/>Record a sourced group booking / access check</label>
      {fields.booking && <><label className="field"><span>Group access state</span><select value={fields.bookingState} onChange={e => setFields({ ...fields, bookingState: e.target.value })}><option value="not-required">Tickets / booking not required</option><option value="available">Group availability checked (not booked)</option><option value="unavailable">Unavailable</option></select></label>{(['start', 'end', 'bookingSource'] as const).map(f => <label className="field" key={f}><span>{f === 'start' ? 'Booking check from' : f === 'end' ? 'Booking check through' : 'Booking / access source URL'}</span><input type={f === 'bookingSource' ? 'url' : 'time'} value={fields[f]} maxLength={1000} onChange={e => setFields({ ...fields, [f]: e.target.value })}/></label>)}</>}
      <button onClick={recordEvidence}>Record sourced checks for preview</button><button onClick={() => { invalidate(); setSourceDirty(false); setFields(empty); setEvidence([]); setMessage('Temporary checks cleared. Preview again; retained decision history is unchanged.'); }}>Clear temporary checks</button></fieldset></details> : null}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
