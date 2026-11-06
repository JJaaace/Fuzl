import { transcriptionResponseSchema } from '@fuzl/planning';
import type { ScreenshotReadRequest, TranscriptionResponse } from '@fuzl/planning';
export async function readScreenshotImages(request: ScreenshotReadRequest, signal: AbortSignal): Promise<TranscriptionResponse> {
  const body = JSON.stringify(request);
  if (body.length > 19_900_000) throw new Error('This screenshot set exceeds Gemini’s encoded request limit. Remove or resize some images; nothing was sent.');
  const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]), cache: 'no-store' });
  const raw = await response.json().catch(() => { throw new Error('The screenshot response could not be read. Your work was kept.'); });
  if (!response.ok) {
    const message = typeof raw?.error?.message === 'string' ? raw.error.message : 'Screenshot reading failed. Your draft and summary were kept. Retry deliberately.';
    const reference = typeof raw?.error?.reference === 'string' && /^[0-9a-f-]{36}$/.test(raw.error.reference) ? ` Error reference: ${raw.error.reference}.` : '';
    throw new Error(message + reference);
  }
  const parsed = transcriptionResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('The screenshot transcript was invalid. Your existing work was kept.');
  return parsed.data;
}
