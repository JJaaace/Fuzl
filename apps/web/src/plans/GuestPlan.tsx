import GuestFeedback from '../outings/GuestFeedback';
import { useEffect, useRef, useState } from 'react';
import { ownRsvpSchema, publicPlanSchema, rsvpPayloadSchema } from '@fuzl/planning';
import type { OwnRsvp, PublicPlan } from '@fuzl/planning';
import { newEditPermission, readPermission } from '../guests/api';
import type { EditPermission } from '../guests/api';
import type { BallotGuestRequest } from '../ballots/GuestBallot';
import Logo from '../ui/Logo';
import Details from './Details';
import { planRequest } from './api';
export default function GuestPlan({ inviteToken, request = planRequest, embedded = false, feedbackRequest }: { inviteToken: string | null; request?: BallotGuestRequest; embedded?: boolean; feedbackRequest?: BallotGuestRequest }) {
  const [page, setPage] = useState<PublicPlan | null>(null), [own, setOwn] = useState<OwnRsvp | null>(null), [alias, setAlias] = useState(''), [choice, setChoice] = useState<'going' | 'maybe' | 'cant' | ''>(''), [approve, setApprove] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [load, setLoad] = useState(0);
  const key = useRef(''), permission = useRef<EditPermission | null>(null), pending = useRef<AbortController | null>(null), sending = useRef(false), notice = useRef<HTMLParagraphElement>(null), attempt = useRef<{ key: string; requestId: string } | null>(null);
  useEffect(() => { const c = new AbortController(); void (async () => {
    try {
      if (!inviteToken) throw Error('Open the complete shared plan link supplied by the organizer.');
      const p = publicPlanSchema.parse(await request('/page', inviteToken, c.signal)), storage = `fuzl-plan-edit-${p.id}`;
      const credential = readPermission(localStorage, storage), raw = credential ? await request('/rsvp', credential.editToken, c.signal, 'GET', undefined, inviteToken) : null;
      const mine = raw === null ? null : ownRsvpSchema.parse(raw); if (c.signal.aborted) return;
      key.current = storage; permission.current = credential; setPage(p); setOwn(mine); setAlias(mine?.alias ?? ''); setChoice(mine?.choice ?? ''); setApprove(false);
      setMessage(mine ? mine.needsReconfirmation ? 'The plan changed. Review the current details and reconfirm your RSVP.' : 'Your own RSVP is restored.' : 'No RSVP yet. Voting did not create an RSVP.');
    } catch (e) { if (!c.signal.aborted) { setPage(null); setError(e instanceof Error && e.name !== 'ZodError' ? e.message : 'Could not verify this plan. Ask for the current link.'); } }
    finally { if (!c.signal.aborted) setLoading(false); }
  })(); return () => { c.abort(); pending.current?.abort(); }; }, [inviteToken, request, load]);
  async function submit() {
    if (!page || !inviteToken || !page.rsvpOpen || sending.current) return;
    const parsed = rsvpPayloadSchema.safeParse({ alias, choice, planVersion: page.version, approved: approve }); if (!parsed.success) { setError('Enter your display name, choose a response and approve the current plan details.'); return; }
    sending.current = true; setBusy(true); setError(''); pending.current = new AbortController(); const c = pending.current;
    try {
      const credential = permission.current ?? newEditPermission(); localStorage.setItem(key.current, JSON.stringify(credential)); permission.current = credential;
      const fingerprint = JSON.stringify([own?.revision, parsed.data]); if (!attempt.current || attempt.current.key !== fingerprint) attempt.current = { key: fingerprint, requestId: crypto.randomUUID() };
      const raw = await request(own ? '/rsvp' : '/rsvps', own ? credential.editToken : inviteToken, c.signal, own ? 'PUT' : 'POST', own ? { revision: own.revision, requestId: attempt.current.requestId, payload: parsed.data } : { ...credential, payload: parsed.data }, own ? inviteToken : undefined);
      const saved = ownRsvpSchema.parse(raw); if (c.signal.aborted) return; setOwn(saved); attempt.current = null; setApprove(false);
      setMessage(saved.alias === parsed.data.alias && saved.choice === parsed.data.choice && !saved.needsReconfirmation ? 'RSVP saved for the current plan. This is separate from your vote; tickets and booking may still need checking.' : 'An earlier RSVP already arrived. Your current entries were kept; submit an update if needed.'); notice.current?.focus();
    } catch (e) { if (!c.signal.aborted) setError(e instanceof Error && e.name !== 'ZodError' ? e.message : 'Could not verify RSVP. Your entries were kept; retry deliberately or reload the current plan.'); }
    finally { sending.current = false; if (!c.signal.aborted) setBusy(false); }
  }
  const Content = embedded ? 'section' : 'main';
  return <div className="page guest-page plan-guest"><header className="app-header"><div className="brand"><Logo/><span>Fuzl</span></div><span className="badge">Shared plan · no account</span></header><Content>
    {loading && <p role="status">Opening shared plan…</p>}{error && <p role="alert" className="validation-error">{error}</p>}
    {page && <><h1>{page.status === 'cancelled' ? 'Plan cancelled' : page.status === 'completed' ? 'Plan completed' : 'The group’s plan'}</h1><p className="eyebrow">{page.status} · Plan version {page.version}</p><p className="notice" role="status"><strong>{page.version > 1 ? 'Plan update: ' : ''}{page.changeNotice}</strong></p><Details details={page.details} sample={page.sample}/><p className="provider-disclosure">Only the organizer-approved plan is shown here. Your name and RSVP are visible to the organizer, not to other guests. A matching name cannot recover someone else’s response. Votes, RSVPs and actual attendance are separate.</p>
      {own?.needsReconfirmation && <p className="notice" role="status">Your previous {own.choice === 'cant' ? 'Can’t make it' : own.choice} response was for earlier plan details. {page.rsvpOpen ? 'It needs reconfirmation and is not counted as current until you review and submit again.' : 'Responses are closed; it remains a historical response.'}</p>}
      {!page.rsvpOpen && <p className="notice">RSVPs are closed{page.status !== 'confirmed' ? ` because this plan is ${page.status}` : ''}. You can still read the current details while this link is valid.</p>}
      <form onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset className="guest-fields" disabled={loading || busy || !page.rsvpOpen}><legend>Your response to this plan</legend><label className="field"><span>Your RSVP name</span><input maxLength={80} autoComplete="nickname" value={alias} onChange={e => { setAlias(e.target.value); setApprove(false); setMessage('Unsaved RSVP changes. Review and submit to save them.'); }}/></label>{(['going', 'maybe', 'cant'] as const).map(v => <label className="ballot-choice" key={v}><input type="radio" name="rsvp-choice" checked={choice === v} onChange={() => { setChoice(v); setApprove(false); setMessage('Unsaved RSVP changes. Review and submit to save them.'); }}/><span>{v === 'going' ? 'Going' : v === 'maybe' ? 'Maybe' : 'Can’t make it'}</span></label>)}<label className="check-label"><input type="checkbox" checked={approve} onChange={e => setApprove(e.target.checked)}/>I reviewed the current plan, version {page.version}, including changes and unresolved details.</label></fieldset><button className="primary" disabled={loading || busy || !page.rsvpOpen} type="submit">{busy ? 'Saving RSVP…' : own?.needsReconfirmation ? 'Reconfirm RSVP' : own ? 'Update my RSVP' : 'Send RSVP'}</button></form>
      {own && <p>Last saved RSVP: {own.alias} · {own.choice === 'cant' ? 'Can’t make it' : own.choice}{own.needsReconfirmation ? ' · Needs reconfirmation' : ''}</p>}<p className="note">The browser stores a private RSVP edit credential, not your unsent entries. Keep this browser/profile to edit your own response. Shared profiles can reuse its permission; clearing storage loses it. Link expires {new Date(page.expiresAt).toLocaleString()}. No other guest’s individual response is returned.</p>
    {page.status === 'completed' && inviteToken && <GuestFeedback invite={inviteToken} planId={page.id} request={feedbackRequest}/>}</>}
    <p ref={notice} tabIndex={-1} role="status" aria-live="polite">{message}</p><button disabled={loading || busy} onClick={() => { if (page && !window.confirm('Reload the current plan and your last RSVP? Unsent entries will be replaced.')) return; setLoading(true); setError(''); setLoad(v => v + 1); }}>Reload shared plan / my RSVP</button>
  </Content></div>;
}
