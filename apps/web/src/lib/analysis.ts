import { analysisRequestSchema, analysisResponseSchema } from '@fuzl/planning';
import type { AnalysisRequest, AnalysisResponse } from '@fuzl/planning';

export function sameAnalysisSource(request: AnalysisRequest, draft: string, referenceDate: string | null): boolean {
  return request.conversation === draft && request.referenceDate === referenceDate;
}

export async function analyzeConversation(request: AnalysisRequest, signal: AbortSignal): Promise<AnalysisResponse> {
  if (!analysisRequestSchema.safeParse(request).success) throw new Error('Use 1–6000 characters and a valid optional reference date.');
  const response = await fetch('/api/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]), cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => { throw new Error('The API returned an unreadable response. Check the API connection and retry.'); });
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' &&
      body.error !== null && 'message' in body.error && typeof body.error.message === 'string' ? body.error.message : `Analysis failed (HTTP ${response.status}). Retry later or use manual entry.`;
    throw new Error(message);
  }
  const result = analysisResponseSchema.safeParse(body);
  if (!result.success) throw new Error('The API returned an invalid summary. Your existing work was kept.');
  return result.data;
}
