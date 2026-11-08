import { z } from 'zod';
import type { PlanningSummary, PlanningFact } from './model.js';
export const guestTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const guestQuestionSchema = z.strictObject({ id: z.string().uuid(), text: z.string().trim().min(1).max(180), type: z.enum(['text', 'availability', 'budget']), required: z.boolean() });
export const guestFormSchema = z.strictObject({ title: z.string().trim().min(1).max(100), questions: z.array(guestQuestionSchema).min(1).max(5), expiresAt: z.string().datetime() });
export const inviteInputSchema = z.strictObject({ title: guestFormSchema.shape.title, questions: guestFormSchema.shape.questions, approved: z.literal(true), replace: z.boolean(), sessionRevision: z.number().int().positive(), days: z.union([z.literal(1), z.literal(7), z.literal(14)]) }).refine(v => new Set(v.questions.map(q => q.id)).size === v.questions.length);
const textAnswer = z.strictObject({ questionId: z.string().uuid(), kind: z.enum(['text', 'availability']), state: z.enum(['blank', 'unknown', 'answered']), text: z.string().trim().max(800).nullable() }).refine(v => v.state === 'answered' ? !!v.text : v.text === null);
const budgetAnswer = z.strictObject({ questionId: z.string().uuid(), kind: z.literal('budget'), state: z.enum(['blank', 'unknown', 'known']), amount: z.number().min(0).max(1000000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < .000001).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(), visibility: z.enum(['private', 'organizer']) }).refine(v => v.state === 'known' ? v.amount !== null : v.amount === null).refine(v => v.state !== 'blank' || v.currency === null);
export const guestAnswerSchema = z.union([textAnswer, budgetAnswer]);
export const responseInputSchema = z.strictObject({ alias: z.string().trim().min(1).max(80), answers: z.array(guestAnswerSchema).min(1).max(5) }).refine(v => new Set(v.answers.map(a => a.questionId)).size === v.answers.length);
export const responseCreateSchema = z.strictObject({ submissionId: z.string().uuid(), editToken: guestTokenSchema, payload: responseInputSchema });
export const responseUpdateSchema = z.strictObject({ revision: z.number().int().positive(), payload: responseInputSchema });
export const guestOriginSchema = z.strictObject({ responseId: z.string().uuid(), revision: z.number().int().positive(), questionId: z.string().uuid(), alias: z.string().min(1).max(80), updatedAt: z.string().datetime(), participantId: z.string().min(1).max(80), sourceText: z.string().max(1600), supersedes: z.string().max(80).nullable() });
export type GuestOrigin = z.infer<typeof guestOriginSchema>;
export type GuestQuestion = z.infer<typeof guestQuestionSchema>;
export type GuestForm = z.infer<typeof guestFormSchema>;
export type InviteInput = z.infer<typeof inviteInputSchema>;
export type GuestAnswer = z.infer<typeof guestAnswerSchema>;
export type ResponseInput = z.infer<typeof responseInputSchema>;
export type PrivateAnswerMarker = {
    questionId: string;
    kind: 'budget';
    state: 'private';
};
export const guestReplySchema = z.strictObject({ id: z.string().uuid(), alias: z.string().min(1).max(80), revision: z.number().int().positive(), updatedAt: z.string().datetime(), answers: z.array(guestAnswerSchema).min(1).max(5) });
export interface GuestReply {
    id: string;
    alias: string;
    revision: number;
    updatedAt: string;
    answers: GuestAnswer[];
}
export interface OrganizerReply extends Omit<GuestReply, 'answers'> {
    inviteId: string;
    questions: GuestQuestion[];
    answers: (GuestAnswer | PrivateAnswerMarker)[];
}
export interface InviteInfo extends GuestForm {
    id: string;
    revokedAt: string | null;
}
export function answersFit(questions: GuestQuestion[], payload: ResponseInput) {
    return payload.answers.length === questions.length && questions.every(q => {
        const a = payload.answers.find(item => item.questionId === q.id);
        return a && a.kind === q.type && (!q.required || a.state !== 'blank');
    });
}
export function answerText(answer: GuestAnswer | PrivateAnswerMarker): string {
    if (answer.state === 'private')
        return 'Private spending answer submitted';
    if (answer.state === 'blank')
        return 'Left blank';
    if (answer.state === 'unknown')
        return 'Explicitly unknown';
    return answer.kind === 'budget' ? `${answer.amount} ${answer.currency ?? '(currency unknown)'}` : answer.text!;
}
export function guestSourceText(reply: Pick<OrganizerReply, 'alias' | 'revision' | 'questions'>, answer: GuestAnswer) { return `Guest reply from ${reply.alias}, revision ${reply.revision}: ${reply.questions.find(q => q.id === answer.questionId)?.text ?? 'Question'} — ${answerText(answer)}`; }
export function participantForFact(fact: PlanningFact, summary: PlanningSummary) { const subject = fact.subject; return subject.kind === 'participant' ? subject.participantId : subject.kind === 'speaker' ? summary.speakers.find(s => s.id === subject.speakerId)?.participantId : null; }
// Applied to the latest local summary, never a stale full-session snapshot.
export function applyGuestAnswer(summary: PlanningSummary, reply: OrganizerReply, questionId: string, participantId: string, resolveId: string | null, supersedes: string | null, mode: 'fact' | 'question' = 'fact', uuid: () => string = () => crypto.randomUUID()): PlanningSummary {
    if (!summary.participants.some(p => p.id === participantId))
        throw new Error('Match this alias to an existing participant first.');
    const answer = reply.answers.find(a => a.questionId === questionId);
    if (!answer || answer.state === 'private' || answer.state === 'blank')
        throw new Error('Only a shareable, nonblank answer can be applied.');
    const quote = guestSourceText(reply, answer);
    if (resolveId && !summary.questions.some(q => q.id === resolveId && q.resolution === null))
        throw new Error('That missing question is no longer unresolved. Review its current answer first.');
    if (mode === 'question') {
        if (!resolveId || !summary.questions.some(q => q.id === resolveId))
            throw new Error('Select an available missing question first.');
        return { ...summary, questions: summary.questions.map(q => q.id === resolveId ? { ...q, resolution: quote, guest: { responseId: reply.id, revision: reply.revision, questionId, alias: reply.alias, updatedAt: reply.updatedAt, participantId, sourceText: quote, supersedes: null } } : q) };
    }
    if (summary.facts.some(f => f.guest?.responseId === reply.id && f.guest.revision === reply.revision && f.guest.questionId === questionId && f.guest.participantId === participantId))
        throw new Error('This answer version is already applied. Edit its existing fact or refresh for a newer reply.');
    const existingSpeaker = summary.speakers.find(s => s.label === `Guest reply: ${reply.alias}` && s.participantId === participantId);
    const speakerId = existingSpeaker?.id ?? uuid(), sourceId = uuid();
    if (summary.facts.length >= 60 || summary.sources.length >= 100 || (!existingSpeaker && summary.speakers.length >= 20))
        throw new Error('This summary has reached its information limit. Remove unused facts first.');
    const old = summary.facts.find(f => f.id === supersedes);
    const kind = answer.kind === 'budget' ? 'budget' : answer.kind === 'availability' ? 'schedule' : 'preference';
    if (supersedes && (!old || old.kind !== kind || old.status !== 'tentative' || !old.extraction || old.extraction.scope === 'historical' || participantForFact(old, summary) !== participantId))
        throw new Error('Choose a tentative AI interpretation for this participant and answer type.');
    const base = { id: uuid(), subject: { kind: 'participant' as const, participantId }, status: 'proposed' as const, strength: 'unknown' as const, sourceIds: [sourceId], guest: { responseId: reply.id, revision: reply.revision, questionId, alias: reply.alias, updatedAt: reply.updatedAt, participantId, sourceText: quote, supersedes } };
    const fact: PlanningFact = answer.kind === 'budget' ? { ...base, kind: 'budget', amount: answer.amount, currency: answer.currency }
        : answer.kind === 'availability' ? { ...base, kind: 'schedule', description: answer.state === 'unknown' ? null : answer.text, exactDate: null, startTime: null, endTime: null }
            : { ...base, kind: 'preference', description: answer.state === 'unknown' ? null : answer.text };
    return { ...summary, speakers: existingSpeaker ? summary.speakers : [...summary.speakers, { id: speakerId, label: `Guest reply: ${reply.alias}`, participantId }], sources: [...summary.sources, { id: sourceId, speakerId, text: quote }], facts: [fact, ...summary.facts.map(f => f.id === supersedes && f.extraction ? { ...f, extraction: { ...f.extraction, scope: 'historical' as const } } : f)], questions: summary.questions.map(q => q.id === resolveId ? { ...q, resolution: quote, relatedFactIds: [...q.relatedFactIds, fact.id] } : q) };
}
