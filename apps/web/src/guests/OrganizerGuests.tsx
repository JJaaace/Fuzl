import { useEffect, useRef, useState } from 'react';
import { answerText, factValue, inviteInputSchema, participantForFact } from '@fuzl/planning';
import type { InviteInfo, GuestAnswer, GuestQuestion, OrganizerReply, PlanningSummary, SavedSession } from '@fuzl/planning';
import { privateRequest } from '../accounts/api';
import AnswerFields, { emptyAnswers, guestDisclosure } from './AnswerFields';
export interface ApplyReply {
    reply: OrganizerReply;
    questionId: string;
    participantId: string;
    resolveId: string | null;
    supersedes: string | null;
    editRevision: number;
    mode: 'fact' | 'question';
}
export default function OrganizerGuests({ token, loaded, summary, getEditRevision, onApply }: {
    token: string;
    loaded: SavedSession;
    summary: PlanningSummary;
    getEditRevision: () => number;
    onApply: (value: ApplyReply) => void;
}) {
    const [open, setOpen] = useState(false);
    const [clock, setClock] = useState(() => Date.now());
    const [version, setVersion] = useState(0);
    const [invite, setInvite] = useState<InviteInfo | null>(null);
    const [replies, setReplies] = useState<OrganizerReply[]>([]);
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<GuestQuestion[]>([{ id: crypto.randomUUID(), text: '', type: 'text', required: false }]);
    const [days, setDays] = useState<1 | 7 | 14>(7);
    const [preview, setPreview] = useState(false);
    const [previewAnswers, setPreviewAnswers] = useState<GuestAnswer[]>([]);
    const [approved, setApproved] = useState(false);
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const pending = useRef<AbortController | null>(null);
    const sending = useRef(false);
    useEffect(() => () => pending.current?.abort(), []);
    const path = `/sessions/${loaded.id}/guest`;
    useEffect(() => {
        if (!open)
            return;
        const controller = new AbortController();
        void Promise.all([privateRequest<InviteInfo | null>(token, `${path}/invite`, controller.signal), privateRequest<OrganizerReply[]>(token, `${path}/responses`, controller.signal)]).then(([info, rows]) => { if (!controller.signal.aborted) {
            setClock(Date.now());
            setInvite(info);
            setReplies(rows);
        } }).catch(error => { if (!controller.signal.aborted)
            setMessage(error instanceof Error ? error.message : 'Could not read responses. Your edits were kept.'); });
        return () => controller.abort();
    }, [open, token, path, version]);
    function invalidate() { setPreview(false); setApproved(false); }
    async function action(work: (signal: AbortSignal) => Promise<void>) {
        if (sending.current)
            return;
        sending.current = true;
        setBusy(true);
        setMessage('');
        const controller = new AbortController();
        pending.current = controller;
        try {
            await work(controller.signal);
        }
        catch (error) {
            if (!controller.signal.aborted)
                setMessage(error instanceof Error ? error.message : 'This action failed. Your work was kept.');
        }
        finally {
            sending.current = false;
            if (!controller.signal.aborted)
                setBusy(false);
        }
    }
    const active = invite && !invite.revokedAt && new Date(invite.expiresAt).getTime() > clock;
    const candidate = { title, questions, approved: true as const, replace: !!active, days, sessionRevision: loaded.revision };
    return <section className="guest-management review-section"><button onClick={() => setOpen(v => !v)} aria-expanded={open}>Ask the group</button>
    <div hidden={!open}><h3>Ask only what you need</h3><p className="note">An active form changes only when you explicitly replace its link. Choose and edit up to five questions. Guests see only the title and questions you approve here—never the full summary, imported chat or supporting quotes. You distribute the link yourself.</p>
      <fieldset disabled={busy} className="guest-fields"><label className="field"><span>Title guests may see</span><input maxLength={100} value={title} onChange={e => { setTitle(e.target.value); invalidate(); }} placeholder="Write a short public title"/></label>
        {summary.questions.some(q => q.resolution === null) && <details><summary>Start from a missing question (review wording first)</summary><p className="note">These are private drafts, not shared automatically. Remove names, quotes or sensitive details before approving.</p>{summary.questions.filter(q => q.resolution === null).map(q => <button className="quiet" key={q.id} disabled={questions.length >= 5 && !!questions[0]?.text} onClick={() => { const next = { id: crypto.randomUUID(), text: q.text.slice(0, 180), type: 'text' as const, required: false }; setQuestions(current => current.length === 1 && !current[0].text ? [next] : [...current, next]); invalidate(); }}>{q.text}</button>)}</details>}
        {questions.map((q, index) => <div className="share-question" key={q.id}><label className="field"><span>Question {index + 1} wording</span><input maxLength={180} value={q.text} onChange={e => { setQuestions(questions.map(item => item.id === q.id ? { ...item, text: e.target.value } : item)); invalidate(); }}/></label><div className="form-grid"><label className="field"><span>Answer type</span><select value={q.type} onChange={e => { setQuestions(questions.map(item => item.id === q.id ? { ...item, type: e.target.value as GuestQuestion['type'] } : item)); invalidate(); }}><option value="text">Short answer</option><option value="availability">Availability (as written)</option><option value="budget">Spending limit</option></select></label><label className="check-label"><input type="checkbox" checked={q.required} onChange={e => { setQuestions(questions.map(item => item.id === q.id ? { ...item, required: e.target.checked } : item)); invalidate(); }}/>Require an answer (unknown is okay)</label></div><button className="quiet danger" disabled={questions.length === 1} onClick={() => { setQuestions(questions.filter(item => item.id !== q.id)); invalidate(); }}>Remove question {index + 1}</button></div>)}
        <button disabled={questions.length >= 5} onClick={() => { setQuestions([...questions, { id: crypto.randomUUID(), text: '', type: 'text', required: false }]); invalidate(); }}>Add question</button>
        <label className="field"><span>Link and edit access expire after</span><select value={days} onChange={e => { setDays(Number(e.target.value) as 1 | 7 | 14); invalidate(); }}><option value="1">1 day</option><option value="7">7 days</option><option value="14">14 days</option></select></label>
        <button disabled={!inviteInputSchema.safeParse(candidate).success} onClick={() => { setPreviewAnswers(emptyAnswers(questions)); setPreview(true); }}>Preview guest form</button>
        {preview && <section className="guest-preview surface" aria-label="Exactly what guests see"><p className="eyebrow">Guest form preview</p><p className="note">Try the fields here. Preview entries are never submitted.</p><h3>{title}</h3><p className="note">{guestDisclosure}</p><label className="field"><span>Your display name or alias</span><input disabled placeholder="Guest enters a name"/></label><AnswerFields questions={questions} answers={previewAnswers} onChange={setPreviewAnswers}/><button className="primary" disabled>Send response</button><p className="note">Guests can send a response and edit it from their browser while the link remains active.</p></section>}
        {preview && <label className="check-label"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)}/>I reviewed this title and every question. This is the wording I want guests to see.</label>}
        <button className="primary" disabled={!preview || !approved} onClick={() => void action(async (signal) => {
            if (active && !window.confirm('Replace the active invite? Its old link AND existing response-edit access will stop. Previously collected replies remain for review.'))
                return;
            const result = await privateRequest<{
                invite: InviteInfo;
                token: string;
            }>(token, `${path}/invite`, signal, 'POST', candidate);
            if (signal.aborted)
                return;
            setClock(Date.now());
            setInvite(result.invite);
            setUrl(`${window.location.origin}/guest#invite=${result.token}`);
            setMessage('Link created. Copy it into your group chat when ready. No message was sent.');
        })}>{active ? 'Replace active link' : 'Create guest link'}</button>
      </fieldset>
      {invite && <div className="invite-state"><details><summary>Currently approved form</summary><h4>{invite.title}</h4><ul>{invite.questions.map(q => <li key={q.id}>{q.text}</li>)}</ul></details><p>{invite.revokedAt ? 'Link revoked' : active ? 'Active invite' : 'Link expired'} · Expires {new Date(invite.expiresAt).toLocaleString()}</p>{url && active ? <><label className="field"><span>Invite link (anyone with it may submit)</span><input readOnly value={url} onFocus={e => e.target.select()}/></label><button disabled={busy} onClick={() => { if (!navigator.clipboard?.writeText) {
            setMessage('Clipboard unavailable. Select the link field and copy it manually.');
            return;
        } void navigator.clipboard.writeText(url).then(() => setMessage('Invite link copied. Paste it into your existing chat.')).catch(() => setMessage('Clipboard unavailable. Select the link field and copy it manually.')); }}>Copy link</button></> : active && <p className="note">The server stores only the link digest. Reopening cannot recover its secret; replace the link explicitly if you need a new copy.</p>}
        {active && <button className="danger quiet" disabled={busy} onClick={() => { if (window.confirm('Revoke this invite and its response-edit permissions? Existing replies and accepted summary values remain until deleted.'))
            void action(async (signal) => { await privateRequest(token, `${path}/invite`, signal, 'DELETE'); if (!signal.aborted) {
                setUrl('');
                setVersion(v => v + 1);
                setMessage('Link revoked. Existing replies remain; submissions and edits are closed.');
            } }); }}>Revoke link</button>}</div>}
      <section className="responses-section"><div className="draft-heading"><h3>Responses</h3><button disabled={busy} onClick={() => setVersion(v => v + 1)}>Refresh responses</button></div><p className="note">Aliases are not verified identities. Match a reply explicitly before applying it. Arriving replies never change your editor automatically. Private spending amounts cannot be applied or shown here.</p>
        {!replies.length && <p>No replies loaded yet.</p>}{replies.map(reply => <ResponseCard key={reply.id} reply={reply} summary={summary} busy={busy} onApply={(questionId, participantId, resolveId, supersedes, mode) => void action(async (signal) => {
                if (document.querySelector('.summary-panel .fact-form'))
                    throw new Error('Apply or cancel open fact/question editors first. Your unapplied work was kept.');
                const editRevision = getEditRevision();
                const latest = await privateRequest<OrganizerReply[]>(token, `${path}/responses`, signal);
                if (signal.aborted)
                    return;
                const current = latest.find(row => row.id === reply.id);
                if (!current || current.revision !== reply.revision) {
                    setReplies(latest);
                    throw new Error('This reply changed. Review its latest answers before applying.');
                }
                if (editRevision !== getEditRevision())
                    throw new Error('Your workspace changed while checking this reply. Review your edits and apply again.');
                onApply({ reply: current, questionId, participantId, resolveId, supersedes, editRevision, mode });
                setMessage(mode === 'question' ? 'Question resolved locally with the original guest excerpt retained. Save session explicitly when ready.' : 'Selected answer applied locally. Original sources and other edits were kept. Review the new proposed fact, then Save session explicitly.');
            })}/>)}</section>
      <p role="status" aria-live="polite">{message}</p>
    </div>
  </section>;
}
function ResponseCard({ reply, summary, busy, onApply }: {
    reply: OrganizerReply;
    summary: PlanningSummary;
    busy: boolean;
    onApply: (questionId: string, participantId: string, resolveId: string | null, supersedes: string | null, mode: 'fact' | 'question') => void;
}) {
    const [participant, setParticipant] = useState('');
    const [question, setQuestion] = useState('');
    const [supersedes, setSupersedes] = useState('');
    const facts = summary.facts.filter(f => f.guest?.responseId === reply.id);
    const unresolved = summary.questions.filter(q => q.resolution === null);
    const resolveId = unresolved.some(q => q.id === question) ? question : null;
    const tentative = summary.facts.filter(f => f.status === 'tentative' && f.extraction && f.extraction.scope !== 'historical' && participantForFact(f, summary) === participant);
    const supersedesId = tentative.some(f => f.id === supersedes) ? supersedes : null;
    return <article className="response-card"><h4>{reply.alias} <span className="badge">Guest response</span></h4><p className="note">Updated {new Date(reply.updatedAt).toLocaleString()} · Revision {reply.revision}{facts.some(f => f.guest!.revision < reply.revision) && ' · Newer than an accepted value; review again'}</p>
    <label className="field"><span>Match this alias to a participant</span><select value={participant} onChange={e => { setParticipant(e.target.value); setSupersedes(''); }}><option value="">Choose explicitly</option>{summary.participants.map((p, i) => <option key={p.id} value={p.id}>{p.name ?? `Unknown participant ${i + 1}`}</option>)}</select></label>
    <label className="field"><span>Also resolve a missing question (optional)</span><select value={resolveId ?? ''} onChange={e => setQuestion(e.target.value)}><option value="">Keep questions unchanged</option>{unresolved.map(q => <option value={q.id} key={q.id}>{q.text}</option>)}</select></label>
    <label className="field"><span>Replace a tentative AI interpretation (optional; its original stays)</span><select value={supersedesId ?? ''} onChange={e => setSupersedes(e.target.value)}><option value="">Add without replacing another fact</option>{tentative.map(f => <option key={f.id} value={f.id}>{f.kind}: {factValue(f)}</option>)}</select></label>
    {reply.answers.map(answer => <div className="response-answer" key={answer.questionId}><strong>{reply.questions.find(q => q.id === answer.questionId)?.text ?? 'Earlier question'}</strong><p>{answerText(answer)}</p>{answer.state !== 'private' && answer.state !== 'blank' && <><button disabled={!participant || busy} onClick={() => onApply(answer.questionId, participant, resolveId, supersedesId, 'fact')}>Apply this answer</button><button disabled={!participant || !resolveId || busy} onClick={() => onApply(answer.questionId, participant, resolveId, null, 'question')}>Resolve selected question only</button></>}</div>)}
  </article>;
}
