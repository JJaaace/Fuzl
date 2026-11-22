import { useEffect, useRef, useState } from 'react';
import { answerRecordedPlan, planAnswerSchema } from '@fuzl/planning';
import type { PlanAnswer, PlanningSummary } from '@fuzl/planning';
import type { ProposalContext } from './PlanSuggestions';
export default function AskFuzl({ summary, sample, context, onSource, onEdit }: {
    summary: PlanningSummary;
    sample: boolean;
    context?: ProposalContext;
    onSource: (id: string) => void;
    onEdit: (id: string) => void;
}) {
    const [question, setQuestion] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [answer, setAnswer] = useState<{
        value: PlanAnswer;
        key: string;
    } | null>(null);
    const lock = useRef(false), serial = useRef(0), latest = useRef(JSON.stringify([summary, context?.saved])), pending = useRef<AbortController | null>(null);
    useEffect(() => { latest.current = JSON.stringify([summary, context?.saved]); }, [summary, context?.saved]);
    useEffect(() => () => { serial.current++; pending.current?.abort(); }, []);
    async function ask(participantId?: string) {
        if (lock.current || !question.trim())
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        const controller = new AbortController();
        pending.current = controller;
        const at = ++serial.current, key = JSON.stringify([summary, context?.saved]), revision = context?.getEditRevision?.();
        try {
            let value: PlanAnswer;
            if (sample && !context?.saved && !summary.facts.some(f => f.guest))
                value = answerRecordedPlan(summary, question, participantId);
            else {
                const response = await fetch('/api/ask-plan', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(context?.token ? { Authorization: `Bearer ${context.token}` } : {}) }, body: JSON.stringify({ summary, question, participantId, ...(context?.saved ? { saved: context.saved } : {}) }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]), cache: 'no-store' });
                let raw: unknown;
                try {
                    raw = await response.json();
                }
                catch {
                    throw Error('The answer response could not be read. Your facts were kept.');
                }
                if (!response.ok) {
                    const e = raw as {
                        error?: {
                            message?: string;
                            reference?: string;
                        };
                    };
                    throw Error((e.error?.message ?? 'Could not answer from this plan.') + (e.error?.reference && /^[a-f\d-]{36}$/.test(e.error.reference) ? ` Reference: ${e.error.reference}` : ''));
                }
                value = planAnswerSchema.parse(raw);
            }
            if (at !== serial.current || controller.signal.aborted)
                return;
            if (!value.items.every(item => summary.facts.some(f => f.id === item.factId && item.sourceIds.every(id => f.sourceIds.includes(id)))) || value.editFactId && !summary.facts.some(f => f.id === value.editFactId))
                throw Error('The answer references could not be verified. Nothing changed.');
            if (latest.current !== key || context?.getEditRevision?.() !== revision) {
                setError('The plan changed while answering. Ask again using the current facts.');
                return;
            }
            setAnswer({ value, key });
        }
        catch (failure) {
            if (at !== serial.current || controller.signal.aborted)
                return;
            setError(failure instanceof Error && failure.name !== 'ZodError' ? failure.message : 'The answer could not be verified. Your facts were kept.');
        }
        finally {
            if (at === serial.current) {
                lock.current = false;
                setBusy(false);
            }
        }
    }
    const current = answer?.key === JSON.stringify([summary, context?.saved]) ? answer.value : null;
    return <section className="ask-fuzl" aria-label="Ask Fuzl"><form onSubmit={event => { event.preventDefault(); void ask(); }}><label className="sr-only" htmlFor="plan-question">Ask Fuzl about this plan</label><input id="plan-question" placeholder="Ask about this plan…" maxLength={300} value={question} onChange={event => setQuestion(event.target.value)}/><button type="submit" disabled={busy || !question.trim()}>{busy ? 'Checking facts…' : 'Ask Fuzl'}</button></form><p className="note">Answers use this plan’s recorded facts. No web search or plan changes.</p>
    {error && <p role="alert">{error}</p>}{answer && !current && <p role="status">Previous answer is out of date. Ask again after your correction.</p>}
    {current && <div className="plan-answer" role="status"><p>{current.text}</p>{current.choices.map(person => <button key={person.id} onClick={() => void ask(person.id)}>Ask about {person.name}</button>)}{current.items.map(item => <div key={item.factId}><p>{item.text}</p>{item.sourceIds.length > 0 && <button className="quiet" onClick={() => onSource(item.factId)}>Source ↗</button>}</div>)}{current.editFactId && <button onClick={() => onEdit(current.editFactId!)}>Open correction editor</button>}</div>}
  </section>;
}
