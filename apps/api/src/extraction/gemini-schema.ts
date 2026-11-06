import { z } from 'zod';
import { factKinds, providerOutputSchema } from '@fuzl/planning';
import type { PlanningFact, Subject } from '@fuzl/planning';
import { invalidOutput } from './errors.js';

const candidate = providerOutputSchema.shape.facts.element;
const common = candidate.shape.fact.options[0].shape;
const nullableText = z.string().nullable();
// Flatten the two nested unions for Google's constrained-output grammar only.
// The complete original schema and source checks still run after conversion.
export const geminiWireSchema = providerOutputSchema.omit({ facts: true }).extend({
  facts: z.array(z.strictObject({
    fact: z.strictObject({
      id: common.id, kind: z.enum(factKinds),
      subjectKind: z.enum(['group', 'unknown', 'participant', 'speaker']), subjectId: common.id.nullable(),
      status: common.status, strength: common.strength, sourceIds: common.sourceIds,
      description: nullableText, exactDate: nullableText, startTime: nullableText, endTime: nullableText,
      amount: z.number().nullable(), currency: nullableText,
      maxMinutes: z.number().nullable(), mode: nullableText, comparison: z.enum(['unknown', 'under', 'at-most']),
    }),
    uncertainty: candidate.shape.uncertainty, scope: candidate.shape.scope, supersedes: candidate.shape.supersedes,
  })).max(60),
});

const allowedKeywords = new Set(['type', 'properties', 'required', 'items', 'enum', 'anyOf', 'additionalProperties', 'description']);
function generationSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(generationSchema);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowedKeywords.has(key)).map(([key, child]) => [key,
    key === 'properties' && typeof child === 'object' && child !== null
      ? Object.fromEntries(Object.entries(child).map(([name, property]) => [name, generationSchema(property)]))
      : generationSchema(child),
  ]));
}
// Omit provider grammar bounds/unsupported keywords, never application checks.
export const geminiResponseSchema = generationSchema(z.toJSONSchema(geminiWireSchema));

export function convertGeminiOutput(raw: unknown) {
  const parsed = geminiWireSchema.safeParse(raw);
  if (!parsed.success) invalidOutput();
  const output = { ...parsed.data, facts: parsed.data.facts.map((item) => {
    const wire = item.fact;
    let subject: Subject;
    if (wire.subjectKind === 'group' || wire.subjectKind === 'unknown') {
      if (wire.subjectId !== null) invalidOutput();
      subject = { kind: wire.subjectKind };
    } else {
      if (wire.subjectId === null) invalidOutput();
      subject = wire.subjectKind === 'speaker' ? { kind: 'speaker', speakerId: wire.subjectId } : { kind: 'participant', participantId: wire.subjectId };
    }
    const relevant = {
      schedule: ['description', 'exactDate', 'startTime', 'endTime'], budget: ['amount', 'currency'],
      activity: ['description'], preference: ['description'], travel: ['maxMinutes', 'mode', 'comparison'],
    }[wire.kind];
    for (const field of ['description', 'exactDate', 'startTime', 'endTime', 'amount', 'currency', 'maxMinutes', 'mode', 'comparison'] as const) {
      if (!relevant.includes(field) && wire[field] !== (field === 'comparison' ? 'unknown' : null)) invalidOutput();
    }
    const base = { id: wire.id, subject, status: wire.status, strength: wire.strength, sourceIds: wire.sourceIds };
    let fact: PlanningFact;
    switch (wire.kind) {
      case 'schedule': fact = { ...base, kind: wire.kind, description: wire.description, exactDate: wire.exactDate, startTime: wire.startTime, endTime: wire.endTime }; break;
      case 'budget': fact = { ...base, kind: wire.kind, amount: wire.amount, currency: wire.currency }; break;
      case 'travel': fact = { ...base, kind: wire.kind, maxMinutes: wire.maxMinutes, comparison: wire.comparison, mode: wire.mode }; break;
      default: fact = { ...base, kind: wire.kind, description: wire.description };
    }
    return { fact, uncertainty: item.uncertainty, scope: item.scope, supersedes: item.supersedes };
  }) };
  const checked = providerOutputSchema.safeParse(output);
  if (!checked.success) invalidOutput();
  return checked.data;
}

export const geminiFormatInstructions = `For the flat fact schema: subjectKind is the original subject kind; subjectId is a speaker or participant ID, or null for group/unknown. Fill only fields appropriate to the fact kind. All irrelevant value fields must be null, and irrelevant comparison must be unknown. No field may contain invented information to satisfy the schema.`;
