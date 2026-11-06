import { z } from 'zod';
import { GEMINI_MODEL } from './contract.js';

export const MAX_SCREENSHOTS = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 8_000_000;
export const MAX_TOTAL_IMAGE_PIXELS = 20_000_000;
export const MAX_IMAGE_EDGE = 4096;
const id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const note = z.string().min(1).max(600);
export const screenshotReadRequestSchema = z.strictObject({
  expectedProvider: z.literal('gemini'),
  images: z.array(z.strictObject({ id, data: z.string().min(4).max(Math.ceil(MAX_IMAGE_BYTES / 3) * 4) })).min(1).max(MAX_SCREENSHOTS),
});
export type ScreenshotReadRequest = z.infer<typeof screenshotReadRequestSchema>;
export const transcriptMessageSchema = z.strictObject({
  id, screenshotId: id, speakerLabel: z.string().min(1).max(100).nullable(),
  text: z.string().min(1).max(2000), visibleDateTime: z.string().min(1).max(100).nullable(),
  uncertainty: note.nullable(), possibleDuplicateOf: id.nullable(),
});
export type TranscriptMessage = z.infer<typeof transcriptMessageSchema>;
export const transcriptionOutputSchema = z.strictObject({
  screenshots: z.array(z.strictObject({ id, notes: z.array(note).max(20) })).min(1).max(MAX_SCREENSHOTS),
  messages: z.array(transcriptMessageSchema).max(100),
});
export type TranscriptionOutput = z.infer<typeof transcriptionOutputSchema>;
export const transcriptionResponseSchema = transcriptionOutputSchema.extend({
  metrics: z.strictObject({ provider: z.literal('gemini'), model: z.literal(GEMINI_MODEL), latencyMs: z.number().nonnegative(),
    inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(), estimatedCostUsd: z.null() }),
});
export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;
export interface TranscriptSnapshot {
  id: string;
  draft: string;
  messages: TranscriptMessage[];
  original: TranscriptionOutput;
}
// Canonical reviewed lines keep unknown attribution explicit. No dates are inferred.
export function transcriptDraft(messages: TranscriptMessage[]) {
  return messages.map((message) => `${message.speakerLabel?.trim() || 'Unknown'}: ${message.text.trim().replace(/\r?\n/g, ' ')}${message.visibleDateTime ? ` [visible date/time: ${message.visibleDateTime.replace(/\r?\n/g, ' ')}]` : ''}${message.uncertainty ? ` [transcription uncertainty: ${message.uncertainty.replace(/\r?\n/g, ' ')}]` : ''}`).join('\n');
}
export function transcriptInputError(messages: TranscriptMessage[]): string | null {
  if (messages.some((message) => !message.text.trim())) return 'Enter message text or remove the unreadable message. Keep uncertainty notes visible.';
  if (messages.some((message) => message.speakerLabel && /[:\r\n]/.test(message.speakerLabel))) return 'Speaker aliases cannot contain a colon or line break. Leave an uncertain identity blank.';
  return null;
}
// Repeated quotes can correspond to multiple screenshots; retain all matches.
export function transcriptSources(snapshot: TranscriptSnapshot, quote: string): TranscriptMessage[] {
  const lines = snapshot.messages.map((message) => transcriptDraft([message]));
  const spans: { start: number; end: number }[] = [];
  let offset = 0;
  for (const line of lines) { spans.push({ start: offset, end: offset + line.length }); offset += line.length + 1; }
  const indices = new Set<number>();
  for (let at = snapshot.draft.indexOf(quote); quote && at !== -1; at = snapshot.draft.indexOf(quote, at + 1)) {
    spans.forEach((span, index) => { if (span.start < at + quote.length && span.end > at) indices.add(index); });
  }
  return [...indices].map((index) => snapshot.messages[index]);
}
