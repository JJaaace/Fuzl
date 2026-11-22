import { z } from 'zod';
import { savedSummarySchema, summaryReferencesValid } from './saved.js';
import { planProposalRequestSchema, cardFactText } from './plan-proposals.js';
import { current } from './place-evaluation.js';
import { participantForFact } from './guests.js';
import type { PlanningSummary } from './model.js';
export const planQuestionRequestSchema = z.strictObject({ summary: savedSummarySchema.refine(summaryReferencesValid), saved: planProposalRequestSchema.shape.saved, question: z.string().trim().min(1).max(300), participantId: z.string().min(1).max(100).optional() });
export type PlanQuestionRequest = z.infer<typeof planQuestionRequestSchema>;
export const planAnswerSchema = z.strictObject({ mode: z.literal('recorded-facts'), text: z.string().max(1000), items: z.array(z.strictObject({ text: z.string().max(2000), factId: z.string(), sourceIds: z.array(z.string()).max(60) })).max(60), choices: z.array(z.strictObject({ id: z.string(), name: z.string() })).max(20), editFactId: z.string().nullable() });
export type PlanAnswer = z.infer<typeof planAnswerSchema>;
export function answerRecordedPlan(summary: PlanningSummary, question: string, participantId?: string): PlanAnswer {
    const q = question.toLowerCase();
    const topic = /availab|\bwhen\b|\btime\b|\bdate\b/.test(q) ? 'schedule' : /budget|spend|afford|money/.test(q) ? 'budget' : /indoor|outdoor|prefer|want|require/.test(q) ? 'preference' : null;
    const empty = (text: string, choices: PlanAnswer['choices'] = []): PlanAnswer => ({ mode: 'recorded-facts', text, items: [], choices, editFactId: null });
    if (!topic)
        return empty('I can check recorded availability, budgets and preferences for this plan. I do not search the web or change facts here.');
    const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const words = ` ${normalize(q)} `;
    const named = summary.participants.filter(p => [p.name, ...summary.speakers.filter(s => s.participantId === p.id).map(s => s.label)].some(name => name?.trim() && words.includes(` ${normalize(name)} `)));
    if (!participantId && !named.length && /^when is (?!the |our |this |everyone|the group)/i.test(question.trim()))
        return empty('That person is not recorded in the current plan. Check the participant name in Group details.');
    if (participantId && !summary.participants.some(p => p.id === participantId))
        return empty('That participant is not in this session. Choose a current person.');
    if (!participantId && named.length > 1)
        return empty('More than one participant matches. Choose the intended person; names do not grant access.', named.map(p => ({ id: p.id, name: `${p.name ?? 'Unknown name'} · participant ${summary.participants.indexOf(p) + 1}` })));
    const person = participantId ? summary.participants.find(p => p.id === participantId) : named[0];
    const facts = summary.facts.filter(f => current(f) && (topic === 'preference' ? f.kind === 'preference' || f.kind === 'activity' : f.kind === topic)).filter(f => !person || f.subject.kind === 'group' || participantForFact(f, summary) === person.id);
    const direction = /indoors?/.test(q) ? /indoors?/i : /outdoors?/.test(q) ? /outdoors?/i : null;
    const selected = direction ? facts.filter(f => (f.kind === 'preference' || f.kind === 'activity') && direction.test(f.description?.split(';')[0] ?? '')) : facts;
    if (!selected.length)
        return empty(`${topic === 'schedule' ? 'Availability' : topic === 'budget' ? 'A public budget' : 'A matching preference'} is not recorded${person ? ` for ${person.name ?? 'this person'}` : ' in this plan'}. Add only what you know in Group details.`);
    const items = selected.map(f => {
        const owner = summary.participants.find(p => p.id === participantForFact(f, summary));
        const name = f.subject.kind === 'group' ? 'Group' : owner?.name ?? 'Attribution unknown';
        const status = `${f.status}${f.extraction && !f.extraction.reviewed ? ' · AI claim — unreviewed' : ''}`;
        return { text: `${name}: ${cardFactText(f)} · ${status} · ${f.strength}${f.kind === 'schedule' && !f.exactDate ? ' · exact date unresolved' : ''}${f.extraction?.scope==='unknown'?' · outing scope unclear':''}${f.extraction?.uncertainty?` · ${f.extraction.uncertainty}`:''}`, factId: f.id, sourceIds: [...f.sourceIds] };
    });
    const edit = /^(please\s+)?(change|set|update|raise|lower|correct|make)\b/.test(q);
    return planAnswerSchema.parse({ mode: 'recorded-facts', text: edit ? 'Nothing changed. Open the existing editor to apply a correction explicitly.' : topic === 'budget' ? 'Current recorded public limits; currencies and per-person amounts are separate. Retained private limits are checked only on the server.' : 'Current applied facts. Original excerpts remain available; tentative statements are not confirmations.', items, choices: [], editFactId: edit && selected.length===1 ? selected[0].id : null });
}
