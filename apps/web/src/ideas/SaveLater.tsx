import { newRecordId } from '@fuzl/planning';
import { useEffect, useRef, useState } from 'react';
import { emptyIdea, ideaContentSchema, ideaSchema } from '@fuzl/planning';
import type { SavedSession, IdeaContent } from '@fuzl/planning';
import { privateRequest } from '../accounts/api';
import IdeaForm from './IdeaForm';
import type { IdeaTransport } from './SavedIdeas';
export interface CardIdeaSelection { snapshotId: string; candidateKey: string; kind: 'place' | 'event'; hint: string; provider: string }
export default function SaveLater({ selection, token, loaded, onDone, onClose, transport }: { selection: CardIdeaSelection; token?: string; loaded: SavedSession; onDone: () => void; onClose: () => void; transport?: IdeaTransport }) {
  const [content, setContent] = useState<IdeaContent>(() => ({ ...emptyIdea(), name: selection.provider === 'ticketmaster' ? '' : selection.hint, kind: selection.kind === 'event' ? 'event' as const : 'venue' as const })), [repeat, setRepeat] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const lock = useRef(false), attempt = useRef<{ key: string; body: unknown } | null>(null), pending = useRef<AbortController | null>(null);
  useEffect(() => { title.current?.focus(); return () => pending.current?.abort(); }, []);
  return <section className="review-section save-later" data-plan-dirty="true"><h3 ref={title} tabIndex={-1}>Save for later · current group</h3><p>Reference: {selection.hint}. Notes stay private. This stores an idea, not a visited place or a fit guarantee.</p>{selection.provider === 'ticketmaster' && <p className="provider-disclosure">Ticketmaster reference only: supply your own label and intended date/details. Fuzl does not permanently copy the API event title, schedule, venue, prices or availability into this bookmark.</p>}<IdeaForm lockKind value={content} onChange={setContent} disabled={busy}/><label className="check-label"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)}/>Save a separate repeat/date if this reference is already saved.</label><button className="primary" disabled={busy} onClick={() => {
    if (lock.current) return; const parsed = ideaContentSchema.safeParse(content); if (!parsed.success) { setMessage('Enter a name and valid optional idea details. Unknown information may stay blank.'); return; }
    lock.current = true; setBusy(true); const data = { snapshotId: selection.snapshotId, candidateKey: selection.candidateKey, sessionRevision: loaded.revision, content: parsed.data, allowDuplicate: repeat }, key = JSON.stringify(data); if (attempt.current?.key !== key) attempt.current = { key, body: { ...data, requestId: newRecordId() } }; const c = new AbortController(); pending.current = c;
    void (transport ? transport('/from-card', 'POST', attempt.current.body, c.signal) : privateRequest(token!, `/sessions/${loaded.id}/ideas/from-card`, c.signal, 'POST', attempt.current.body)).then(raw => { ideaSchema.parse(raw); if (!c.signal.aborted) onDone(); }).catch(e => { if (!c.signal.aborted) setMessage(e instanceof Error && e.name !== 'ZodError' ? e.message : 'Could not verify the saved idea. Entries kept.'); }).finally(() => { lock.current = false; if (!c.signal.aborted) setBusy(false); });
  }}>{busy ? 'Saving reference…' : 'Save reference to group'}</button><button disabled={busy} onClick={() => { if (window.confirm('Discard these unsaved Save for later fields?')) { pending.current?.abort(); onClose(); } }}>Cancel save for later</button><p role="status">{message}</p></section>;
}
