import { useEffect, useRef, useState } from 'react';
import { ballotDashboardSchema, ballotViewSchema, guestTokenSchema, shortlistContentSchema, shortlistSchema, tallyLabel } from '@fuzl/planning';
import type { BallotDashboard, BallotPublish, SavedSession, ShortlistContent } from '@fuzl/planning';
import { privateRequest } from '../accounts/api';
import { newEditPermission } from '../guests/api';
import OptionDetails from './OptionDetails';
import OptionEditor from './OptionEditor';
export interface BallotPanelProps { token?: string; loaded?: SavedSession; content: ShortlistContent; onContent: (c: ShortlistContent) => void; onMessage: (m: string) => void; changeRevision: () => number; demoDashboard?: BallotDashboard; demoRequest?: (path: string, method: string, data?: unknown) => Promise<unknown> }
export default function OrganizerBallot({ token, loaded, content, onContent, onMessage, changeRevision, demoDashboard, demoRequest }: BallotPanelProps) {
  const [dashboard, setDashboard] = useState<BallotDashboard>(demoDashboard ?? { shortlist: null, ballots: [] });
  const [draftRevision, setDraftRevision] = useState(0), [savedContent, setSavedContent] = useState('');
  const [preview, setPreview] = useState<ShortlistContent | null>(null), [approved, setApproved] = useState(false), [days, setDays] = useState<1 | 7 | 14>(7);
  const [busy, setBusy] = useState(false), [link, setLink] = useState(''), [linkVersion, setLinkVersion] = useState<number | null>(null);
  const operation = useRef(0);
  const pending = useRef<AbortController | null>(null), sending = useRef(false), loadedOnce = useRef(false), publication = useRef<{ key: string; input: BallotPublish } | null>(null);
  const current = useRef(content); useEffect(() => { current.current = content; }, [content]);
  const request = async (path: string, method = 'GET', data?: unknown, signal = new AbortController().signal) => demoRequest ? demoRequest(path, method, data) : privateRequest(token!, `/sessions/${loaded!.id}/ballots${path}`, signal, method, data);
  const loadedId = loaded?.id;
  useEffect(() => {
    const controller = new AbortController(), at = changeRevision();
    void (demoRequest ? demoRequest('', 'GET') : privateRequest(token!, `/sessions/${loadedId}/ballots`, controller.signal)).then(raw => {
      if (controller.signal.aborted) return;
      const data = ballotDashboardSchema.parse(raw); setDashboard(data);
      if (!loadedOnce.current && data.shortlist) {
        setSavedContent(JSON.stringify(data.shortlist.content));setDraftRevision(data.shortlist.revision);
        if(at===0 && changeRevision()===at)onContent(data.shortlist.content);
        else onMessage('Local shortlist choices were kept. Reload the saved shortlist explicitly to replace them.');
      }
      loadedOnce.current = true;
    }).catch(() => { if (!controller.signal.aborted) onMessage('Could not load ballots. Check migrations/connection and refresh deliberately; local selections were kept.'); });
    return () => { controller.abort(); pending.current?.abort(); };
  }, [token, loadedId, demoRequest, changeRevision, onContent, onMessage]);
  async function work(action: (signal: AbortSignal) => Promise<void>) {
    if (sending.current) return; const serial = ++operation.current; sending.current = true; setBusy(true); onMessage(''); pending.current = new AbortController(); const c = pending.current; c.signal.addEventListener('abort', () => { if (serial === operation.current) { sending.current = false; setBusy(false); } }, { once: true });
    try { await action(c.signal); } catch (e) { if (!c.signal.aborted) onMessage(e instanceof Error && e.name !== 'ZodError' ? e.message : 'The ballot response could not be verified. Your shortlist was kept.'); }
    finally { if (serial === operation.current) { sending.current = false; if (!c.signal.aborted) setBusy(false); } }
  }
  async function refresh(signal: AbortSignal) { const d = ballotDashboardSchema.parse(await request('', 'GET', undefined, signal)); if (!signal.aborted) setDashboard(d); return d; }
  const clean = savedContent === JSON.stringify(content), previewCurrent = !!preview && JSON.stringify(preview) === JSON.stringify(content), latest = dashboard.ballots[0];
  return <section className="review-section ballot-organizer" data-ballot-dirty={!clean && (!!content.options.length || draftRevision > 0 || content.title !== 'Which option would you prefer?') ? 'true' : 'false'}><h3>Shortlist & voting</h3><p className="note">Select up to three discovery cards or add an idea. This shortlist is saved separately from the planning summary. Selected cards are copied snapshots; later discovery changes do not silently update them. Votes express preference, never attendance, booking or plan confirmation.</p>
    <label className="field"><span>Public ballot title</span><input maxLength={100} value={content.title} onChange={e => onContent({ ...content, title: e.target.value })}/></label>
    {!content.options.length && <p>No options selected. Use “Add to shortlist” on Places or Events, or add an idea below.</p>}
    {content.options.map((o, i) => <article className="place-card" key={o.id}><OptionDetails option={o}/><OptionEditor value={o} onChange={v => onContent({ ...content, options: content.options.map(p => p.id === o.id ? v : p) })}/><button onClick={() => onContent({ ...content, options: content.options.filter(p => p.id !== o.id) })}>Remove option {i + 1}</button></article>)}
    <button disabled={content.options.length >= 3 || busy} onClick={() => onContent({ ...content, options: [...content.options, { id: crypto.randomUUID(), kind: 'idea', name: 'New manual idea', time: null, location: null, cost: { amount: null, currency: null, kind: 'unknown', basis: 'unknown' }, links: [], unresolved: ['Time, location and total cost need checking', 'Travel and booking availability unverified'], sample: !!demoRequest }] })}>Add manual idea</button>
    <div className="places-actions"><button disabled={busy} onClick={() => void work(async signal => {
      const parsed = shortlistContentSchema.safeParse(content); if (!parsed.success) throw Error('Check public option fields, URLs and unresolved details. Use up to three options; blank amounts mean unknown.');
      const snapshot = JSON.stringify(parsed.data); const saved = shortlistSchema.parse(await request('/shortlist', 'PUT', { content: parsed.data, revision: draftRevision, sessionRevision: loaded?.revision ?? 1 }, signal));
      if (signal.aborted) return; setDraftRevision(saved.revision); setSavedContent(snapshot); onMessage('Shortlist saved. Newer edits, if any, remain unsaved. Published ballots are unchanged.'); await refresh(signal);
    })}>Save shortlist</button><button disabled={busy} onClick={() => void work(async signal => { await refresh(signal); onMessage('Tallies refreshed. Your shortlist edits were kept.'); })}>Refresh tallies</button><button disabled={busy} onClick={() => { if (!window.confirm('Reload the saved shortlist and replace local option edits? Published ballots stay unchanged.')) return; void work(async signal => { const at = changeRevision(), d = await refresh(signal); if (!signal.aborted && changeRevision() === at && d.shortlist) { onContent(d.shortlist.content); setDraftRevision(d.shortlist.revision); setSavedContent(JSON.stringify(d.shortlist.content)); } }); }}>Reload saved shortlist</button></div>
    <p className="note">{clean ? 'Saved shortlist' : 'Unsaved shortlist edits'} · {content.options.length}/3 options. Refreshing tallies does not discard edits.</p>
    <button disabled={busy || !clean || !content.options.length} onClick={() => { setPreview(structuredClone(content)); setApproved(false); }}>Preview ballot</button>
    {preview && <section className="ballot-preview"><h3>Guest ballot preview</h3><p>{preview.title}</p>{preview.options.map(o => <OptionDetails key={o.id} option={o}/>)}<p className="provider-disclosure">Only this displayed title and option data will be published. No private budgets, conversations, participant list or organizer notes are included. Anyone with the link can read and submit a vote; forwarding it permits another response. Display names never grant edit access.</p>{!previewCurrent && <p role="alert">Options changed. Save and preview again before publishing.</p>}
      <label className="field"><span>Voting link lifetime</span><select disabled={busy} value={days} onChange={e => { setDays(Number(e.target.value) as 1 | 7 | 14); setApproved(false); }}>{[1, 7, 14].map(n => <option key={n} value={n}>{n} day{n === 1 ? '' : 's'}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)}/>I reviewed these public details and approve publishing this ballot.</label>
      <button className="primary" disabled={busy || !clean || !previewCurrent || !approved} onClick={() => void work(async signal => {
        const key = JSON.stringify([draftRevision, latest?.id, days]);
        if (!publication.current || publication.current.key !== key) publication.current = { key, input: { publicationId: crypto.randomUUID(), inviteToken: newEditPermission().editToken, expectedBallotId: latest?.id ?? null, shortlistRevision: draftRevision, sessionRevision: loaded?.revision ?? 1, approved: true, days } };
        const raw = await request('/publish', 'POST', publication.current.input, signal) as { ballot: unknown; token: unknown }; const b = ballotViewSchema.parse(raw.ballot), t = guestTokenSchema.parse(raw.token);
        if (signal.aborted) return; setLink(demoRequest ? 'Simulated link — use Guest ballot demo above; this is not a server link' : `${window.location.origin}/vote#invite=${t}`); setLinkVersion(b.version); setApproved(false); publication.current = null; onMessage(`Ballot v${b.version} published. Earlier votes remain with earlier versions; share the new link yourself.`); await refresh(signal);
      })}>{latest ? 'Publish revised ballot' : 'Publish ballot'}</button>
    </section>}
    {link && <label className="field"><span>Guest voting link for v{linkVersion} (shown only in this workspace; copy privately)</span><input readOnly value={link} onFocus={e => e.target.select()} /></label>}
    <h3>Ballot versions & tally</h3><p className="note">Counts are credential-scoped responses, not verified people, attendance or RSVPs. No responses transfer between versions. Reopening the workspace cannot recover an old shared token; publish a revision if you lost its link.</p>
    {dashboard.ballots.map((b, i) => <section className="place-card" key={b.id}><h4>{i === 0 ? 'Current' : 'Earlier'} ballot v{b.version} · {b.state}</h4><p>{b.title} · {b.totalResponses} total responses · {tallyLabel(b)}</p>{b.supersededByVersion && <p>Earlier-version votes only. Replaced by v{b.supersededByVersion}.</p>}<ul>{b.options.map(o => <li key={o.id}>{o.name}: {b.counts.find(c => c.optionId === o.id)?.votes ?? 0} votes</li>)}</ul><p className="note">Expires {new Date(b.expiresAt).toLocaleString()}</p><button disabled={busy || b.state !== 'open'} onClick={() => { if (window.confirm(`Close voting for v${b.version}? Existing votes stay visible; no plan is selected.`)) void work(async signal => { await request(`/${b.id}/close`, 'POST', { revision: b.revision }, signal); await refresh(signal); }); }}>Close voting v{b.version}</button><button disabled={busy || b.state === 'revoked'} onClick={() => { if (window.confirm(`Revoke all guest read/edit access to v${b.version}?`)) void work(async signal => { await request(`/${b.id}/revoke`, 'POST', { revision: b.revision }, signal); await refresh(signal); setLink(''); }); }}>Revoke voting link v{b.version}</button></section>)}
  </section>;
}
