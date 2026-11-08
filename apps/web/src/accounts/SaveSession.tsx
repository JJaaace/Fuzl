import OrganizerGuests from '../guests/OrganizerGuests';
import type { ApplyReply } from '../guests/OrganizerGuests';
import { useEffect, useRef, useState } from 'react';
import { sessionInputSchema } from '@fuzl/planning';
import type { SavedGroup, SavedSession, SessionInput } from '@fuzl/planning';
import { useAccount } from './AccountProvider';
import { privateRequest, RequestLifetime, SavedWorkError, validateLoadedSession } from './api';
import { Field } from '../planning/FactEditor';
export default function SaveSession({ input, loaded, onSaved, onOpen, onSignIn, getEditRevision = () => 0, onApplyGuest }: {
  onApplyGuest: (value: ApplyReply) => void; getEditRevision?: () => number; input: SessionInput; loaded: SavedSession | null; onSaved: (session: SavedSession, unchanged: boolean) => void;
  onOpen: (session: SavedSession) => void; onSignIn: () => void;
}) {
  const { session } = useAccount();
  return session ? <SignedInSave key={session.user.id} token={session.access_token} onApplyGuest={onApplyGuest} getEditRevision={getEditRevision} input={input} loaded={loaded} onSaved={onSaved} onOpen={onOpen} />
    : <div className="save-session"><p className="notice">Save this session to create a link.</p><p>Save the summary and supporting message excerpts. Raw screenshots and the entire conversation are not saved.</p><button className="primary" onClick={onSignIn}>Sign in to save session</button></div>;
}
function SignedInSave({ token, input, loaded, onSaved, onOpen, getEditRevision, onApplyGuest }: {
  onApplyGuest: (value: ApplyReply) => void; token: string; getEditRevision: () => number; input: SessionInput; loaded: SavedSession | null; onSaved: (session: SavedSession, unchanged: boolean) => void; onOpen: (session: SavedSession) => void;
}) {
  const [title, setTitle] = useState(loaded?.title ?? input.title); const [groupId, setGroupId] = useState(loaded?.groupId ?? '');
  const [groups, setGroups] = useState<SavedGroup[]>([]); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false); const [version, setVersion] = useState(0);
  const lifetime = useRef(new RequestLifetime()); const latest = useRef(input);
  useEffect(() => { latest.current = input; }, [input]);
  useEffect(() => { const active = new RequestLifetime(); lifetime.current = active; return () => active.dispose(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void privateRequest<SavedGroup[]>(token, '/groups', controller.signal).then((data) => { if (!controller.signal.aborted) setGroups(data); }).catch((error) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Could not read groups.'); });
    return () => controller.abort();
  }, [token, version]);
  async function save(copy = false) {
    if (busy || !groupId) return;
    if (document.querySelector('.summary-panel .fact-form')) { setMessage('Apply or cancel open fact/question edits before saving. Your edits were kept.'); return; }
    const payload = { ...input, title }; const parsed = sessionInputSchema.safeParse(payload);
    if (!parsed.success) { setMessage('Check the session title, applied fields and source references before saving.'); return; }
    const active = lifetime.current; const snapshot = JSON.stringify(input); const editRevision = getEditRevision(); setBusy(true); setMessage('Saving…');
    try {
      const updating = loaded && !copy;
      const result = validateLoadedSession(await privateRequest<SavedSession>(token, updating ? `/sessions/${loaded.id}` : `/groups/${groupId}/sessions`, active.signal,
        updating ? 'PUT' : 'POST', updating ? { payload: parsed.data, groupId, revision: loaded.revision } : parsed.data));
      if (active.signal.aborted) return;
      const unchanged = getEditRevision() === editRevision && JSON.stringify(latest.current) === snapshot && !document.querySelector('.summary-panel .fact-form');
      onSaved(result, unchanged); setConflict(false);
      setMessage(unchanged ? 'Saved. Your draft and screenshots remain temporary; the summary and supporting excerpts are stored.' : 'Submitted version saved. Newer editor changes remain unsaved; save again when ready.');
    } catch (error) {
      if (active.signal.aborted) return;
      setConflict(error instanceof SavedWorkError && error.status === 409);
      setMessage(error instanceof Error ? error.message : 'Save failed. Your edits were kept. Retry deliberately.');
    } finally { if (!active.signal.aborted) setBusy(false); }
  }
  return <section className="save-session" aria-labelledby="save-title"><h3 id="save-title">Save this session</h3>
    <p className="note">Keeps the applied summary, review labels and supporting excerpts. Raw imports stay temporary. Apply or cancel open editors before saving.</p>
    <div className="form-grid"><Field label="Session title" value={title} maxLength={100} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
      <label className="field"><span>Save under group</span><select value={groupId} disabled={busy} onChange={(event) => setGroupId(event.target.value)}><option value="">Choose a group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>
    {!groups.length && <p>Create a group in Saved groups, then refresh this list. Your editor stays available.</p>}
    <div className="actions"><button className="primary" disabled={busy || !groupId || !title.trim()} onClick={() => void save()}>{busy ? 'Saving…' : 'Save session'}</button>
      {loaded && <button disabled={busy || !groupId} onClick={() => void save(true)}>Save as new session</button>}
      <button disabled={busy} onClick={() => setVersion((value) => value + 1)}>Refresh groups</button>
      {conflict && loaded && <button disabled={busy} onClick={() => {
        const active = lifetime.current;
        void privateRequest<SavedSession>(token, `/sessions/${loaded.id}`, active.signal).then((result) => { if (!active.signal.aborted) onOpen(validateLoadedSession(result)); }).catch(() => { if (!active.signal.aborted) setMessage('Could not reopen the latest version. Your edits were kept.'); });
      }}>Open latest version</button>}</div><p role="status" aria-live="polite">{message}</p>
    {loaded ? <OrganizerGuests key={loaded.id} token={token} loaded={loaded} summary={input.summary} getEditRevision={getEditRevision} onApply={onApplyGuest} /> : <p className="notice">Save this session to create a link.</p>}
    {loaded && <p className="note">Saved revision {loaded.revision} · Last saved {new Date(loaded.updatedAt).toLocaleString()}</p>}
  </section>;
}
