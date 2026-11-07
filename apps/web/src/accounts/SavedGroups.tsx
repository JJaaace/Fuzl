import { useEffect, useRef, useState } from 'react';
import type { SavedGroup, SavedSession, SessionListItem } from '@fuzl/planning';
import { useAccount } from './AccountProvider';
import { privateRequest, RequestLifetime, validateLoadedSession } from './api';
import { Field } from '../planning/FactEditor';
import { requestMagicLink } from './magicLink';

function SignIn() {
  const { client, loading, error, session, reload } = useAccount();
  const [email, setEmail] = useState(session?.user.email ?? ''); const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const lifetime = useRef(new RequestLifetime());
  useEffect(() => { const active = new RequestLifetime(); lifetime.current = active; return () => active.dispose(); }, []);
  return <section className="account-card"><h2>Sign in to save private work</h2><p>The temporary workspace remains available. Signing in uploads no draft, image or transcript. Signing into a different account clears the previous account’s workspace.</p>
    {loading && <p role="status">Checking account configuration…</p>}{error && <p role="status">{error}</p>}
    <form onSubmit={(event) => {
      event.preventDefault(); if (!client || busy || sent) return;
      const sequence = lifetime.current.capture(); setBusy(true); setMessage('');
      void requestMagicLink(client.auth, email, window.location.origin).then((failure) => {
        if (!lifetime.current.current(sequence)) return;
        if (failure) setMessage(failure);
        else { setSent(true); setMessage('Link requested. Check your organization-member inbox and spam folder. Open the email link in this browser, preferably a new tab; then return to this tab without reloading to keep your unsaved work. Sending a link does not mean you are signed in. No planning data was sent.'); }
      }).catch(() => { if (lifetime.current.current(sequence)) setMessage('Could not reach sign-in. Your temporary work was kept.'); }).finally(() => { if (lifetime.current.current(sequence)) setBusy(false); });
    }}><Field label="Email" type="email" required autoComplete="email" value={email} disabled={sent || busy} onChange={(event) => setEmail(event.target.value)} />
      <button disabled={!client || busy || loading || sent}>{busy ? 'Requesting link…' : sent ? 'Check your email' : 'Send sign-in link'}</button>
      {sent && <button type="button" disabled={busy} onClick={() => { setSent(false); setMessage('Request another link only if needed; the default sender has a very small quota.'); }}>Use another email or prepare a new link</button>}
    </form><p role="status">{message}</p>{(!client || error) && <button type="button" disabled={loading || busy} onClick={reload}>Reload account configuration</button>}<p className="note">Free development email delivery is restricted to Supabase organization members and currently two messages/hour. Follow the setup guide before testing.</p>
  </section>;
}
export default function SavedGroups({ onOpen, onWorkspace, active = true }: { active?: boolean; onOpen: (session: SavedSession) => void; onWorkspace: () => void }) {
  const { session } = useAccount();
  const [reauthenticating, setReauthenticating] = useState(false);
  if (!session) return <SignIn />;
  return <><button onClick={() => setReauthenticating((value) => !value)}>{reauthenticating ? 'Back to saved groups' : 'Verify sign-in again'}</button>
    {reauthenticating && <SignIn />}
    <div hidden={reauthenticating}><GroupLibrary key={session.user.id} token={session.access_token} active={active && !reauthenticating} onOpen={onOpen} onWorkspace={onWorkspace} /></div></>;
}
function GroupLibrary({ token, active, onOpen, onWorkspace }: { token: string; active: boolean; onOpen: (session: SavedSession) => void; onWorkspace: () => void }) {
  const [groups, setGroups] = useState<SavedGroup[]>([]); const [selected, setSelected] = useState<SavedGroup | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]); const [name, setName] = useState(''); const [aliases, setAliases] = useState('');
  const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [version, setVersion] = useState(0);
  const lifetime = useRef(new RequestLifetime());
  useEffect(() => { const active = new RequestLifetime(); lifetime.current = active; return () => active.dispose(); }, []);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void privateRequest<SavedGroup[]>(token, '/groups', controller.signal).then((data) => { if (!controller.signal.aborted) setGroups(data); }).catch((error) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Could not load groups.'); });
    return () => controller.abort();
  }, [token, version, active]);
  async function act(work: (active: RequestLifetime) => Promise<void>) {
    if (busy) return; const active = lifetime.current; setBusy(true); setMessage('');
    try { await work(active); } catch (error) { if (!active.signal.aborted) setMessage(error instanceof Error ? error.message : 'Saved work failed. Retry deliberately.'); }
    finally { if (!active.signal.aborted) setBusy(false); }
  }
  const selectedId = selected?.id;
  useEffect(() => {
    if (!active || !selectedId) return;
    const controller = new AbortController();
    void privateRequest<SessionListItem[]>(token, `/groups/${selectedId}/sessions`, controller.signal).then((data) => {
      if (!controller.signal.aborted) { setSessions(data); setMessage(''); }
    }).catch((error) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Could not open this group.'); });
    return () => controller.abort();
  }, [token, selectedId, version, active]);
  function select(group: SavedGroup) {
    if (editing && !window.confirm('Discard these unsaved group edits and open another group?')) return;
    setSelected(group); setSessions([]); setEditing(false); setVersion((value) => value + 1);
  }
  return <section className="saved-library"><h1>Your saved groups</h1><p>Groups belong only to your organizer account. Participant aliases are names, not authenticated members. Budgets and availability remain session-specific.</p>
    <div className="library-layout"><aside><button disabled={busy} onClick={() => { if (editing && !window.confirm('Discard these unsaved group edits and create another group?')) return; setSelected(null); setEditing(true); setName(''); setAliases(''); }}>Create group</button>
      <ul>{groups.map((group) => <li key={group.id}><button disabled={busy} onClick={() => void select(group)} aria-pressed={selected?.id === group.id}>{group.name} ({group.sessionCount})</button></li>)}</ul></aside>
      <div>{editing ? <form onSubmit={(event) => { event.preventDefault(); void act(async (active) => {
        const input = { name, aliases: aliases.split('\n').map((item) => item.trim()).filter(Boolean) };
        const group = await privateRequest<SavedGroup>(token, selected ? `/groups/${selected.id}` : '/groups', active.signal, selected ? 'PUT' : 'POST', selected ? { ...input, revision: selected.revision } : input);
        if (active.signal.aborted) return; setSelected(group); setSessions([]); setEditing(false); setVersion((value) => value + 1);
      }); }}><Field label="Group name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        <label className="field"><span>Participant aliases (one per line, up to 20)</span><textarea value={aliases} onChange={(event) => setAliases(event.target.value)} /></label>
        <div className="actions"><button disabled={busy}>{busy ? 'Saving group…' : 'Save group'}</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div></form> : selected ? <>
        <h2>{selected.name}</h2><p className="note">Updated {new Date(selected.updatedAt).toLocaleString()} · Aliases: {selected.aliases.map((alias) => alias.name).join(', ') || 'None yet'}</p>
        <div className="actions"><button disabled={busy} onClick={() => { setName(selected.name); setAliases(selected.aliases.map((alias) => alias.name).join('\n')); setEditing(true); }}>Edit group and aliases</button>
          <button disabled={busy} onClick={() => { if (!window.confirm(`Delete “${selected.name}” and ALL its saved sessions, aliases and source excerpts? This cannot be undone in Fuzl.`)) return; void act(async (active) => {
            await privateRequest(token, `/groups/${selected.id}`, active.signal, 'DELETE'); if (active.signal.aborted) return; setSelected(null); setSessions([]); setVersion((value) => value + 1);
          }); }}>Delete group</button></div>
        <button onClick={onWorkspace}>Go to workspace to save a session</button>
        <ul>{sessions.map((item) => <li key={item.id}><strong>{item.title}</strong><p className="note">Updated {new Date(item.updatedAt).toLocaleString()}</p>
          <div className="actions"><button disabled={busy} onClick={() => void act(async (active) => {
            const result = validateLoadedSession(await privateRequest<SavedSession>(token, `/sessions/${item.id}`, active.signal)); if (!active.signal.aborted) onOpen(result);
          })}>Open session</button><button disabled={busy} onClick={() => { if (!window.confirm(`Delete “${item.title}”, including its saved summary and source excerpts?`)) return;
            void act(async (active) => { await privateRequest(token, `/sessions/${item.id}`, active.signal, 'DELETE'); if (!active.signal.aborted) { setSessions((current) => current.filter((entry) => entry.id !== item.id)); setVersion((value) => value + 1); } });
          }}>Delete session</button></div></li>)}</ul>
      </> : <p>Create a group or choose one to see its saved sessions.</p>}</div></div><p role="status" aria-live="polite">{message}</p><button onClick={() => setVersion((value) => value + 1)}>Refresh groups</button>
  </section>;
}
