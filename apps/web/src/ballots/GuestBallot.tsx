import { newRecordId } from '@fuzl/planning';
import { useEffect, useRef, useState } from 'react';
import { ballotViewSchema, voteSchema } from '@fuzl/planning';
import type { BallotView, OwnVote } from '@fuzl/planning';
import { newEditPermission, permissionKey, readPermission } from '../guests/api';
import type { EditPermission } from '../guests/api';
import { ballotRequest } from './api';
import Logo from '../ui/Logo';
import OptionDetails from './OptionDetails';
export type BallotGuestRequest = (path: string, token: string, signal: AbortSignal, method?: string, body?: unknown, invite?: string) => Promise<unknown>;
export default function GuestBallot({ inviteToken, request = ballotRequest, embedded = false }: { inviteToken: string | null; request?: BallotGuestRequest; embedded?: boolean }) {
  const [ballot, setBallot] = useState<BallotView | null>(null), [own, setOwn] = useState<OwnVote | null>(null), [choice, setChoice] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [load, setLoad] = useState(0);
  const permission = useRef<EditPermission | null>(null), key = useRef(''), pending = useRef<AbortController | null>(null), sending = useRef(false), choiceVersion = useRef(0), notice = useRef<HTMLParagraphElement>(null);
  const editAttempt = useRef<{ key: string; requestId: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (!inviteToken) throw Error('Open the complete ballot link supplied by the organizer.');
        const form = ballotViewSchema.parse(await request('/form', inviteToken, controller.signal));
        const storage = (await permissionKey(inviteToken)).replace('fuzl-guest-edit-', 'fuzl-ballot-edit-');
        const stored = readPermission(localStorage, storage);
        const raw = stored ? await request('/vote', stored.editToken, controller.signal, 'GET', undefined, inviteToken) : null;
        const mine = raw === null ? null : voteSchema.parse(raw);
        if (mine && !form.options.some(o => o.id === mine.optionId)) throw Error('Your saved vote did not match this ballot version.');
        if (controller.signal.aborted) return;
        key.current = storage; permission.current = stored; setBallot(form); setOwn(mine); setChoice(mine?.optionId ?? '');
        if (mine) setMessage('Your vote is restored. Only this browser’s private credential can edit it.');
      } catch (e) { if (!controller.signal.aborted) { setBallot(null); setError(e instanceof Error && e.name !== 'ZodError' ? e.message : 'The ballot could not be verified. Ask for the current link.'); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); pending.current?.abort(); };
  }, [inviteToken, request, load]);
  async function submit() {
    if (!inviteToken || !ballot || ballot.state !== 'open' || sending.current) return;
    if (!ballot.options.some(o => o.id === choice)) { setError('Choose one option before submitting.'); return; }
    const selected = choice, version = choiceVersion.current;
    sending.current = true; setBusy(true); setError(''); setMessage(''); pending.current = new AbortController(); const controller = pending.current;
    try {
      const credential = permission.current ?? newEditPermission();
      // Persist permission BEFORE sending so a lost response/reload cannot create
      // another vote. A name, option or shared invite is never edit authority.
      localStorage.setItem(key.current, JSON.stringify(credential)); permission.current = credential;
      const attemptKey = JSON.stringify([own?.revision, selected]);
      if (!editAttempt.current || editAttempt.current.key !== attemptKey) editAttempt.current = { key: attemptKey, requestId: newRecordId() };
      const raw = await request(own ? '/vote' : '/votes', own ? credential.editToken : inviteToken, controller.signal, own ? 'PUT' : 'POST', own ? { revision: own.revision, requestId: editAttempt.current.requestId, optionId: selected } : { ...credential, optionId: selected }, own ? inviteToken : undefined);
      const result = voteSchema.parse(raw); if (!ballot.options.some(o => o.id === result.optionId)) throw Error('The returned vote did not match this ballot.');
      if (controller.signal.aborted) return;
      setOwn(result); editAttempt.current = null;
      if (choiceVersion.current === version && result.optionId === selected) setMessage('Vote saved. This is a preference, not an RSVP or a confirmed plan.');
      else setMessage('Your earlier vote was saved. Your newer choice remains unsent; submit again to change it.');
      notice.current?.focus();
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error && e.name !== 'ZodError' ? e.message : 'Could not verify the vote. Your selection was kept; retry deliberately or reload your sent vote.'); }
    finally { sending.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  const Content = embedded ? 'section' : 'main';
  return <div className="page guest-page ballot-guest"><header className="app-header"><div className="brand"><Logo/><span>Fuzl</span></div><span className="badge">Guest ballot · no account</span></header><Content>
    {loading && <p role="status">Opening ballot…</p>}{error && <p role="alert" className="validation-error">{error}</p>}
    {ballot && <><h1>{ballot.title}</h1><p className="eyebrow">Ballot version {ballot.version} · {ballot.state}</p><p className="provider-disclosure">Choose one preferred option. Voting does not confirm attendance, tickets, bookings or the final plan. You can change only your own vote while voting is open. You cannot see other guests’ votes or private planning information.</p>
      {ballot.state !== 'open' && <p role="status" className="notice">Voting is {ballot.state} for this version.{ballot.supersededByVersion && ` The organizer published v${ballot.supersededByVersion}; ask for its new link. Earlier votes do not transfer.`}</p>}
      <form onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset className="guest-fields" disabled={loading || busy || ballot.state !== 'open'}><legend>Your preferred option</legend>{ballot.options.map(o => <article className={`place-card vote-option ${choice === o.id ? 'is-selected' : ''}`} key={o.id}><label className="ballot-choice"><input type="radio" name="ballot-choice" value={o.id} checked={choice === o.id} onChange={() => { choiceVersion.current++; setChoice(o.id); setMessage('Choice changed. Submit to save your vote.'); }}/><span>Choose {o.name}</span></label><OptionDetails option={o} showTitle={false}/></article>)}</fieldset><button className="primary" type="submit" disabled={loading || busy || ballot.state !== 'open'}>{busy ? 'Saving vote…' : own ? 'Save vote change' : 'Submit vote'}</button></form>
      {own && <p>Last saved choice: {ballot.options.find(o => o.id === own.optionId)?.name}</p>}<p className="note">Expires {new Date(ballot.expiresAt).toLocaleString()}. Expiry or revocation ends guest read/edit access. Your browser stores a private edit credential, not your unsent choice. Clearing site data, another browser or a shared browser profile affects access. Counts are responses, not verified identities; forwarding a shared link permits another response.</p>
    </>}
    <p ref={notice} tabIndex={-1} role="status" aria-live="polite">{message}</p><button className="quiet" disabled={loading || busy} onClick={() => { if (ballot && !window.confirm('Reload the published ballot and your last sent vote? Unsent selections will be replaced.')) return; setLoading(true); setError(''); setLoad(v => v + 1); }}>Reload ballot / my vote</button>
  </Content></div>;
}
