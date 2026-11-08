import type { GuestAnswer, GuestQuestion } from '@fuzl/planning';
export const guestDisclosure = 'The organizer can see your alias and shareable answers. Other guests cannot see your reply. Private spending amounts are visible only to you in this interface and retained separately by Fuzl. A name is a label, not verified identity. This is not an RSVP or booking.';
export function emptyAnswers(questions: GuestQuestion[]): GuestAnswer[] { return questions.map(q => q.type === 'budget' ? { questionId: q.id, kind: 'budget', state: 'blank', amount: null, currency: null, visibility: 'private' } : { questionId: q.id, kind: q.type, state: 'blank', text: null }); }
export default function AnswerFields({ questions, answers, onChange, disabled = false }: {
    questions: GuestQuestion[];
    answers: GuestAnswer[];
    onChange: (answers: GuestAnswer[]) => void;
    disabled?: boolean;
}) {
    return <>{questions.map(q => {
            const answer = answers.find(a => a.questionId === q.id)!;
            const change = (next: GuestAnswer) => onChange(answers.map(a => a.questionId === q.id ? next : a));
            return <fieldset key={q.id} disabled={disabled} className="guest-question"><legend>{q.text} <span className="muted">{q.required ? '(required; unknown accepted)' : '(optional)'}</span></legend>
      {answer.kind === 'budget' ? <>
        <label className="field"><span>Spending limit</span><select value={answer.state} onChange={e => change({ ...answer, state: e.target.value as 'blank' | 'unknown' | 'known', amount: null, currency: e.target.value === 'blank' ? null : answer.currency })}><option value="blank">Leave blank</option><option value="unknown">I don’t know yet</option><option value="known">Enter my limit (zero is allowed)</option></select></label>
        {answer.state === 'known' && <div className="form-grid"><label className="field"><span>Maximum amount per person</span><input type="number" inputMode="decimal" min="0" max="1000000" step="0.01" value={answer.amount ?? ''} onChange={e => change({ ...answer, amount: e.target.value === '' ? null : Number(e.target.value) })}/></label><label className="field"><span>Currency (blank = unknown)</span><input value={answer.currency ?? ''} maxLength={3} placeholder="e.g. USD" onChange={e => change({ ...answer, currency: e.target.value.toUpperCase() || null })}/></label></div>}
        {answer.state !== 'blank' && <label className="field"><span>Who may see this spending answer?</span><select value={answer.visibility} onChange={e => change({ ...answer, visibility: e.target.value as 'private' | 'organizer' })}><option value="private">Private: only I can see the amount</option><option value="organizer">Share this amount with the organizer</option></select></label>}
        <p className="note">Private amounts are retained separately by Fuzl for future feasibility checks. The organizer sees only that a private answer exists; no feasibility checks happen yet. Choosing private later cannot erase an amount you previously shared or the organizer already accepted.</p>
      </> : <>
        <label className="field"><span>{q.type === 'availability' ? 'When could you join? Keep tentative wording.' : 'Your answer'}</span><textarea maxLength={800} disabled={disabled || answer.state === 'unknown'} value={answer.text ?? ''} placeholder={q.type === 'availability' ? 'e.g. Maybe Friday after 7; exact date not decided' : 'Leave empty to skip an optional question'} onChange={e => change({ ...answer, state: e.target.value.trim() ? 'answered' : 'blank', text: e.target.value.trim() ? e.target.value : null })}/></label>
        <label className="check-label"><input type="checkbox" checked={answer.state === 'unknown'} onChange={e => change({ ...answer, state: e.target.checked ? 'unknown' : 'blank', text: null })}/>I don’t know yet</label>
      </>}
    </fieldset>;
        })}</>;
}
