import type { ZodError } from 'zod';
import type { ServerFailure } from './provider-diagnostics.js';

export type ValidationStage = 'transcription_schema' | 'transcription_sources' | 'provider_envelope' | 'provider_json' | 'gemini_wire' | 'gemini_conversion' | 'canonical_schema' | 'source_validation' | 'field_validation' | 'response_contract';
const rules = [
  'invalid_type', 'invalid_value', 'invalid_format', 'too_small', 'too_big', 'unrecognized_keys', 'invalid_union', 'not_multiple_of', 'invalid_key', 'invalid_element', 'custom',
  'screenshot_order', 'message_order', 'duplicate_message', 'unknown_screenshot', 'duplicate_reference',
  'invalid_json', 'missing_text', 'blocked_response', 'truncated_response', 'incomplete_response', 'unexpected_candidate_count', 'missing_content',
  'subject_id_required', 'subject_id_must_be_null', 'irrelevant_field_non_null', 'duplicate_id', 'unknown_reference', 'speaker_not_in_source', 'unknown_speaker_has_participant',
  'participant_not_in_speakers', 'quote_not_exact', 'quote_speaker_mismatch', 'subject_evidence_mismatch', 'invalid_supersession', 'number_not_in_quote', 'currency_not_in_quote', 'invalid_fields',
  'invalid_amount', 'invalid_currency', 'invalid_minutes', 'invalid_date', 'invalid_time', 'invalid_window',
] as const;
export type ValidationRule = typeof rules[number];
export interface ValidationDiagnostic { stage: ValidationStage; path: string; rule: ValidationRule }

// Only schema-owned field names and numeric array positions enter diagnostics.
// Never serialize Zod messages, unexpected key names, input, expected values, quotes, or IDs.
const fields = new Set(('screenshots messages notes screenshotId speakerLabel visibleDateTime uncertainty possibleDuplicateOf participants speakers sources facts questions id name label participantId speakerId text fact kind subject subjectKind subjectId status strength sourceIds description exactDate startTime endTime amount currency maxMinutes mode comparison uncertainty scope supersedes relatedFactIds resolution candidates content parts finishReason promptFeedback blockReason usageMetadata promptTokenCount candidatesTokenCount thoughtsTokenCount summary warnings metrics provider model latencyMs inputTokens outputTokens estimatedCostUsd extraction reviewed reportedStatus').split(' '));
export function validationDiagnostic(stage: ValidationStage, path: readonly PropertyKey[], rule: ValidationRule): ValidationDiagnostic {
  const safePath = path.reduce<string>((result, part) => {
    if (typeof part === 'number' && Number.isInteger(part) && part >= 0 && part < 10000) return `${result}[${part}]`;
    const name = typeof part === 'string' && fields.has(part) ? part : 'unknown_field';
    return `${result}${result ? '.' : ''}${name}`;
  }, '') || '$';
  return { stage, path: safePath, rule };
}

export class ExtractionError extends Error {
  readonly reference = crypto.randomUUID();
  constructor(public status: number, public code: string, message: string, public diagnostic?: ValidationDiagnostic, public serverFailure?: ServerFailure) {
    super(message);
  }
}
export function invalidOutput(stage: ValidationStage = 'canonical_schema', path: readonly PropertyKey[] = [], rule: ValidationRule = 'invalid_value'): never {
  throw new ExtractionError(502, 'invalid_output', 'The AI response could not be verified. Your existing summary was kept. Use manual entry or inspect the server diagnostic using this error reference.', validationDiagnostic(stage, path, rule));
}
export function schemaFailure(stage: ValidationStage, error: Pick<ZodError, 'issues'>): never {
  const issue = error.issues[0];
  const rule = rules.find((value) => value === issue?.code) ?? 'invalid_value';
  invalidOutput(stage, issue?.path ?? [], rule);
}
