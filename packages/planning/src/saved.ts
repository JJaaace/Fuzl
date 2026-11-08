import { z } from 'zod';
import { guestOriginSchema } from './guests.js';
import { planningSummarySchema } from './contract.js';
import { applyFields, editFields } from './model.js';
import type { PlanningSummary } from './model.js';
import { transcriptSources } from './screenshots.js';
import type { TranscriptSnapshot } from './screenshots.js';
export const recordId = z.string().uuid();
const title = z.string().trim().min(1).max(100);
export const groupInputSchema = z.strictObject({ name: title, aliases: z.array(title).max(20) });
export const groupUpdateSchema = groupInputSchema.extend({ revision: z.number().int().positive() });
const provenanceEntry = z.strictObject({
  screenshotId: z.string().min(1).max(80), originalSpeaker: z.string().max(100).nullable(), reviewedSpeaker: z.string().max(100).nullable(),
  originalVisibleDateTime: z.string().max(100).nullable(), reviewedVisibleDateTime: z.string().max(100).nullable(),
  originalText: z.string().max(2000).nullable(), reviewedText: z.string().max(2000), uncertainty: z.string().max(600).nullable(),
});
export const savedProvenanceSchema = z.array(z.strictObject({ sourceId: z.string().min(1).max(80), entries: z.array(provenanceEntry).max(20) })).max(100);
export type SavedProvenance = z.infer<typeof savedProvenanceSchema>;
export function excerptProvenance(summary: PlanningSummary, snapshot: TranscriptSnapshot | null): SavedProvenance {
  if (!snapshot) return [];
  return summary.sources.flatMap((source) => {
    const messages = transcriptSources(snapshot, source.text);
    return messages.length ? [{ sourceId: source.id, entries: messages.map((message) => {
      const original = snapshot.original.messages.find((item) => item.id === message.id);
      return { screenshotId: message.screenshotId, originalSpeaker: original?.speakerLabel ?? null, reviewedSpeaker: message.speakerLabel,
        originalVisibleDateTime: original?.visibleDateTime ?? null, reviewedVisibleDateTime: message.visibleDateTime,
        originalText: original?.text ?? null, reviewedText: message.text, uncertainty: original?.uncertainty ?? message.uncertainty };
    }) }] : [];
  });
}
export function supportingSummary(summary: PlanningSummary): PlanningSummary {
  const cited = new Set(summary.facts.flatMap((fact) => fact.sourceIds));
  return { ...summary, sources: summary.sources.filter((source) => cited.has(source.id)) };
}
export function summaryReferencesValid(summary: PlanningSummary): boolean {
  const unique = (items: { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;
  if (![summary.participants, summary.speakers, summary.sources, summary.facts, summary.questions].every(unique)) return false;
  const has = (items: { id: string }[], id: string) => items.some((item) => item.id === id);
  if ([...summary.facts,...summary.questions].some(item => item.guest && !summary.participants.some(p => p.id === item.guest!.participantId))) return false;
  return summary.speakers.every((speaker) => speaker.participantId === null || has(summary.participants, speaker.participantId)) &&
    summary.sources.every((source) => has(summary.speakers, source.speakerId)) &&
    summary.questions.every((question) => question.relatedFactIds.every((id) => has(summary.facts, id))) &&
    summary.facts.every((fact) => fact.sourceIds.every((id) => has(summary.sources, id)) &&
      (fact.subject.kind !== 'speaker' || has(summary.speakers, fact.subject.speakerId)) &&
      (fact.subject.kind !== 'participant' || has(summary.participants, fact.subject.participantId)) && applyFields(fact, editFields(fact)).ok);
}
// Save the existing editor model, including manually entered facts without
// evidence. Provider output and analysis-response schemas remain unchanged.
const [schedule, budget, activity, travel, preference] = planningSummarySchema.shape.facts.element.options;
const manualEvidence = { guest: guestOriginSchema.optional(), sourceIds: z.array(schedule.shape.sourceIds.element).max(20) };
export const savedSummarySchema = planningSummarySchema.extend({ questions: z.array(planningSummarySchema.shape.questions.element.extend({ guest: guestOriginSchema.optional() })).max(30), facts: z.array(z.discriminatedUnion('kind', [
  schedule.extend(manualEvidence), budget.extend(manualEvidence), activity.extend(manualEvidence),
  travel.extend(manualEvidence), preference.extend(manualEvidence),
])).max(60) }).refine((summary) => summary.facts.every((fact) => (!fact.extraction && !fact.guest) || fact.sourceIds.length > 0));
export const sessionInputSchema = z.strictObject({
  title, summaryVersion: z.literal(1), summary: savedSummarySchema.refine(summaryReferencesValid).refine((summary) => summary.sources.every((source) => summary.facts.some((fact) => fact.sourceIds.includes(source.id)))),
  provenance: savedProvenanceSchema, origin: z.enum(['sample', 'manual', 'ai']),
}).superRefine((value, context) => {
  if (value.provenance.some((item) => !value.summary.sources.some((source) => source.id === item.sourceId))) context.addIssue({ code: 'custom', path: ['provenance'], message: 'Unknown source reference' });
});
export const sessionUpdateSchema = z.strictObject({ payload: sessionInputSchema, groupId: recordId, revision: z.number().int().positive() });
export type SessionInput = z.infer<typeof sessionInputSchema>;
export interface SavedGroup { id: string; name: string; revision: number; aliases: { id: string; name: string }[]; createdAt: string; updatedAt: string; sessionCount: number }
export interface SessionListItem { id: string; groupId: string; title: string; revision: number; createdAt: string; updatedAt: string }
export interface SavedSession extends SessionListItem { payload: SessionInput }
export function quotesUnchanged(previous: SessionInput, next: SessionInput): boolean {
  return previous.summary.sources.every((source) => !next.summary.sources.some((item) => item.id === source.id) || next.summary.sources.some((item) => item.id === source.id && item.text === source.text && item.speakerId === source.speakerId)) &&
    previous.provenance.every((source) => !next.summary.sources.some((item) => item.id === source.sourceId) || next.provenance.some((item) => item.sourceId === source.sourceId && JSON.stringify(item) === JSON.stringify(source)));
}
