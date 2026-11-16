import { z } from 'zod';
import { analysisResponseSchema } from './contract.js';
import { savedSummarySchema, summaryReferencesValid } from './saved.js';
import { assessedPlaceSchema, manualCandidateSchema } from './places.js';
import { participantForFact } from './guests.js';
import { attributed, current, settled } from './place-evaluation.js';
import type { PlanningFact, PlanningSummary } from './model.js';

export function moneyText(amount: number | null, currency: string | null, perPerson = false) {
  if (amount === null) return currency ? `Amount unknown · ${currency}` : 'Amount unknown';
  const value = currency === 'USD' ? `$${amount}` : currency ? `${currency} ${amount}` : `${amount} · currency unknown`;
  return value + (perPerson ? '/person' : '');
}
export function personFacts(summary: PlanningSummary, id: string) {
  return summary.facts.filter(fact => participantForFact(fact, summary) === id);
}
// A common window needs explicit settled availability for every known person.
// Never interpret a weekday, a missing answer or an unmapped alias as agreement.
export function commonWindow(summary: PlanningSummary) {
  const timing = summary.facts.filter(f => current(f) && f.kind === 'schedule');
  const known = timing.filter(f => f.kind === 'schedule' && settled(f) && f.exactDate && f.startTime && f.endTime);
  const covered = summary.participants.length > 0 && summary.participants.every(p => known.some(f => f.subject.kind === 'group' || participantForFact(f, summary) === p.id));
  const multiple = summary.participants.some(p => known.filter(f => participantForFact(f, summary) === p.id).length > 1) || known.filter(f => f.subject.kind === 'group').length > 1;
  if (!covered || multiple || timing.some(f => !settled(f) || !attributed(f, summary))) return { date: null, start: null, end: null, conflict: false, label: multiple ? 'Multiple availability windows · review which to use' : 'Availability not confirmed for everyone' };
  const dates = new Set(known.map(f => f.kind === 'schedule' ? f.exactDate : null));
  const start = known.map(f => f.kind === 'schedule' ? f.startTime! : '').sort().at(-1)!;
  const end = known.map(f => f.kind === 'schedule' ? f.endTime! : '').sort()[0];
  if (dates.size !== 1 || start >= end) return { date: null, start: null, end: null, conflict: known.every(f => f.strength === 'firm'), label: 'Confirmed availability does not overlap' };
  const date = [...dates][0]!;
  return { date, start, end, conflict: false, label: `${date} · ${start}–${end} · confirmed overlapping availability` };
}
export function cardFactText(fact: PlanningFact) {
  if (fact.kind === 'budget') return moneyText(fact.amount, fact.currency, true);
  if (fact.kind === 'travel') {
    const mode = /^(driving|drive)$/i.test(fact.mode ?? '') ? 'drive' : fact.mode ?? 'mode unknown';
    return fact.maxMinutes === null ? `Travel time unknown · ${mode}` : fact.comparison === 'at-most' ? `${fact.maxMinutes} min max ${mode}` : fact.comparison === 'under' ? `Under ${fact.maxMinutes} min ${mode}` : `${fact.maxMinutes} min · limit type unknown · ${mode}`;
  }
  if (fact.kind === 'schedule') return [fact.exactDate ?? fact.description ?? 'Date unknown', fact.startTime ? `${fact.startTime}–${fact.endTime ?? 'end unknown'}` : 'Time unknown'].join(' · ');
  return fact.description ?? 'Unknown';
}
export const planProposalRequestSchema = z.strictObject({
  expectedProvider: z.literal('gemini'),
  summary: savedSummarySchema.refine(summaryReferencesValid),
  manual: z.array(manualCandidateSchema).max(3),
  saved: z.strictObject({ id: z.string().uuid(), revision: z.number().int().positive() }).optional(),
});
export type PlanProposalRequest = z.infer<typeof planProposalRequestSchema>;
export const planProposalResponseSchema = z.strictObject({
  mode: z.enum(['checks', 'gemini']), selectedId: z.string().nullable(),
  window: z.strictObject({ date: z.string().nullable(), start: z.string().nullable(), end: z.string().nullable(), conflict: z.boolean(), label: z.string() }),
  candidates: z.array(assessedPlaceSchema).max(3),
  metrics: analysisResponseSchema.shape.metrics.nullable(),
  scope: z.strictObject({ label: z.string().max(100), count: z.number().int().nonnegative() }),
  message: z.string().max(500),
});
export type PlanProposalResponse = z.infer<typeof planProposalResponseSchema>;
