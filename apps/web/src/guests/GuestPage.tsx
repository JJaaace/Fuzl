import { useEffect, useRef, useState } from 'react';
import { answersFit, responseInputSchema } from '@fuzl/planning';
import type { GuestForm, GuestReply, ResponseInput } from '@fuzl/planning';
import Logo from '../ui/Logo';
import DotField from '../ui/DotField';
import AnswerFields, { emptyAnswers, guestDisclosure } from './AnswerFields';
import { guestRequest, newEditPermission, permissionKey, readGuestForm, readPermission, replyPayload } from './api';
import type { EditPermission } from './api';
export default function GuestPage({ inviteToken }: {
    inviteToken: string | null;
}) {
    const [form, setForm] = useState<GuestForm | null>(null);
    const [payload, setPayload] = useState<ResponseInput>({ alias: '', answers: [] });
    const [revision, setRevision] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loadVersion, setLoadVersion] = useState(0);
    const permission = useRef<EditPermission | null>(null);
    const storageKey = useRef('');
    const pending = useRef<AbortController | null>(null);
    const sending = useRef(false);
    const errorNotice = useRef<HTMLDivElement>(null);
    useEffect(() => { if (error) errorNotice.current?.focus(); }, [error]);
    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                if (!inviteToken)
                    throw new Error('This invite is missing or invalid. Open the complete link supplied by the organizer.');
                const data = await readGuestForm(inviteToken, controller.signal);
                const key = await permissionKey(inviteToken);
                const stored = readPermission(localStorage, key);
                // Verify storage before allowing a first write; preserve edit permission before POST.
                localStorage.setItem('fuzl-guest-storage-check', '1');
                localStorage.removeItem('fuzl-guest-storage-check');
                let own: GuestReply | null = null;
                if (stored) {
                    try {
                        const restored = await guestRequest<GuestReply>('/response', stored.editToken, controller.signal, 'GET', undefined, inviteToken);
                        if (!answersFit(data.questions, replyPayload(restored))) throw new Error('The saved response does not match this form. Your editing permission was kept; ask the organizer to check the link.');
                        own = restored;
                    }
                    catch (failure) {
                        // An uncertain POST may not have reached the server. Keep its key;
                        // explicit retry reuses the same submission ID, never an alias lookup.
                        if (controller.signal.aborted)
                            return;
                        setMessage(failure instanceof Error ? `${failure.message} If your first send failed, retry with this browser’s retained permission.` : 'Could not restore your response.');
                    }
                }
                if (controller.signal.aborted)
                    return;
                storageKey.current = key;
                permission.current = stored;
                setForm(data);
                setRevision(own?.revision ?? null);
                setPayload(own ? replyPayload(own) : { alias: '', answers: emptyAnswers(data.questions) });
                if (own)
                    setMessage('Your response is restored. You can edit only this response.');
            }
            catch (failure) {
                if (!controller.signal.aborted)
                    setError(failure instanceof DOMException && failure.name === 'SecurityError' ? 'Allow site storage for this app, then retry. Editing permission must survive reload before a response can be sent.' : failure instanceof Error ? failure.message : 'This form could not load. Check your connection and browser storage, then retry.');
            }
            finally {
                if (!controller.signal.aborted)
                    setLoading(false);
            }
        })();
        return () => { controller.abort(); pending.current?.abort(); };
    }, [inviteToken, loadVersion]);
    async function submit() {
        if (!form || !inviteToken || sending.current)
            return;
        const parsed = responseInputSchema.safeParse(payload);
        if (!parsed.success || !answersFit(form.questions, parsed.data)) {
            setError('Enter a display name and valid answers. For required questions, an explicit unknown is okay. Zero is different from unknown or blank.');
            return;
        }
        sending.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        const controller = new AbortController();
        pending.current = controller;
        try {
            const credential = permission.current ?? newEditPermission();
            localStorage.setItem(storageKey.current, JSON.stringify(credential));
            permission.current = credential;
            const result = await guestRequest<GuestReply>(revision === null ? '/responses' : '/response', revision === null ? inviteToken : credential.editToken, controller.signal, revision === null ? 'POST' : 'PUT', revision === null ? { ...credential, payload: parsed.data } : { revision, payload: parsed.data }, revision === null ? undefined : inviteToken);
            if (controller.signal.aborted)
                return;
            if (!answersFit(form.questions, replyPayload(result))) throw new Error('The response did not match this form. Your typed answers were kept.');
            setRevision(result.revision);
            setMessage(JSON.stringify(replyPayload(result)) === JSON.stringify(parsed.data) ? 'Response sent. Only your response can be edited here.' : 'An earlier send already arrived. Your current entries were kept; save changes to update that response.');
        }
        catch (failure) {
            if (!controller.signal.aborted)
                setError(failure instanceof Error ? failure.message : 'Could not send. Your typed answers were kept; retry deliberately.');
        }
        finally {
            sending.current = false;
            if (!controller.signal.aborted)
                setBusy(false);
        }
    }
    return <div className="page guest-page"><DotField active dimmed /><header className="app-header"><div className="brand"><Logo /><span>Fuzl</span></div><span className="badge">Guest response · no account</span></header><main>
    {loading && <p role="status">Opening your form…</p>}
    {error && <div ref={errorNotice} tabIndex={-1} role="alert" className="validation-error">{error}</div>}
    {!loading && !form && <button onClick={() => (setLoading(true), setError(''), setLoadVersion(v => v + 1))}>Retry opening form</button>}
    {form && <><p className="eyebrow">A question for the group</p><h1>{form.title}</h1><p className="provider-disclosure">{guestDisclosure}</p>
      <form noValidate onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset disabled={busy || loading} className="guest-fields"><label className="field"><span>Your display name or alias</span><input required maxLength={80} autoComplete="nickname" value={payload.alias} onChange={e => setPayload({ ...payload, alias: e.target.value })}/></label><AnswerFields questions={form.questions} answers={payload.answers} disabled={busy || loading} onChange={answers => setPayload({ ...payload, answers })}/></fieldset>
        <button className="primary" disabled={busy || loading} type="submit">{busy ? 'Sending…' : revision === null ? 'Send response' : 'Save response changes'}</button>
      </form>{revision !== null && <button className="quiet" disabled={busy || loading} onClick={() => { if (window.confirm('Reload your last sent response? Unsaved form entries will be replaced.')) {
            setLoading(true);
            setError('');
            setLoadVersion(v => v + 1);
        } }}>Reload sent response</button>}<p role="status" aria-live="polite">{message}</p><p className="note">Link expires {new Date(form.expiresAt).toLocaleString()}. Revocation, replacement or expiry ends submission/edit access. Existing answers remain with the organizer until the session is deleted.</p><p className="note">This browser stores editing permission, not your typed draft. Reload restores only successfully sent answers. Anyone using this browser profile could use its permission. Do not share it; using another browser or clearing site data loses access. You can reopen the original invite in this browser while it remains active.</p></>}
  </main></div>;
}
