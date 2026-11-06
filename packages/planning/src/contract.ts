import { z } from 'zod';
import type { PlanningSummary } from './model.js';

export const MAX_CONVERSATION_LENGTH = 6000;
export const MODEL = 'gpt-5.4-mini-2026-03-17';
export const MAX_OUTPUT_TOKENS = 6000;
export const PROVIDER_TIMEOUT_MS = 45000;

const id = z.string().min(1).max(80);
const text = z.string().min(1).max(6000);
const shortText = z.string().min(1).max(600);
const status = z.enum(['proposed', 'tentative', 'confirmed', 'conflicting']);
const scope = z.enum(['current', 'historical', 'unknown']);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
export const analysisRequestSchema = z.strictObject({
  conversation: z.string().min(1).max(MAX_CONVERSATION_LENGTH).refine((value) => value.trim().length > 0),
  referenceDate: date.nullable(),
});
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

const subject = z.union([
  z.strictObject({ kind: z.literal('group') }), z.strictObject({ kind: z.literal('unknown') }),
  z.strictObject({ kind: z.literal('participant'), participantId: id }),
  z.strictObject({ kind: z.literal('speaker'), speakerId: id }),
]);
const base = {
  id, subject, status, strength: z.enum(['unknown', 'firm', 'flexible']), sourceIds: z.array(id).min(1).max(20),
};
const factSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...base, kind: z.literal('schedule'), description: shortText.nullable(), exactDate: z.string().nullable(), startTime: z.string().nullable(), endTime: z.string().nullable() }),
  z.strictObject({ ...base, kind: z.literal('budget'), amount: z.number().nonnegative().max(Number.MAX_SAFE_INTEGER / 100).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable() }),
  z.strictObject({ ...base, kind: z.literal('activity'), description: shortText.nullable() }),
  z.strictObject({ ...base, kind: z.literal('travel'), maxMinutes: z.number().int().nonnegative().nullable(), comparison: z.enum(['at-most', 'under', 'unknown']), mode: shortText.nullable() }),
  z.strictObject({ ...base, kind: z.literal('preference'), description: shortText.nullable() }),
]);
const questionSchema = z.strictObject({
  id, kind: z.enum(['missing', 'conflict']), text: shortText, relatedFactIds: z.array(id).max(60), resolution: shortText.nullable(),
});
const summaryShape = {
  participants: z.array(z.strictObject({ id, name: shortText.nullable() })).max(20),
  speakers: z.array(z.strictObject({ id, label: shortText, participantId: id.nullable() })).max(20),
  sources: z.array(z.strictObject({ id, speakerId: id, text })).max(100),
  questions: z.array(questionSchema).max(30),
};

// Provider output is only a candidate. The server assigns review state itself.
export const providerOutputSchema = z.strictObject({
  ...summaryShape,
  facts: z.array(z.strictObject({
    fact: factSchema, uncertainty: shortText, scope, supersedes: z.array(id).max(20),
  })).max(60),
});
export type ProviderOutput = z.infer<typeof providerOutputSchema>;

const extractionSchema = z.strictObject({
  reviewed: z.boolean(), reportedStatus: status, uncertainty: shortText, scope, supersedes: z.array(id).max(20),
});
const [scheduleFact, budgetFact, activityFact, travelFact, preferenceFact] = factSchema.options;
// Same existing summary model, with optional provenance on AI-derived facts.
export const planningSummarySchema = z.strictObject({
  ...summaryShape,
  facts: z.array(z.discriminatedUnion('kind', [
    scheduleFact.extend({ extraction: extractionSchema.optional() }),
    budgetFact.extend({ extraction: extractionSchema.optional() }),
    activityFact.extend({ extraction: extractionSchema.optional() }),
    travelFact.extend({ extraction: extractionSchema.optional() }),
    preferenceFact.extend({ extraction: extractionSchema.optional() }),
  ])).max(60),
}) satisfies z.ZodType<PlanningSummary>;

export const analysisResponseSchema = z.strictObject({
  summary: planningSummarySchema,
  warnings: z.array(shortText).max(100),
  metrics: z.strictObject({
    model: z.literal(MODEL), latencyMs: z.number().nonnegative(),
    inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(),
    estimatedCostUsd: z.number().nonnegative().nullable(),
  }),
});
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
