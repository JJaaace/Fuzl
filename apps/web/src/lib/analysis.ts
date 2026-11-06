import { aiConfigurationSchema, analysisRequestSchema, analysisResponseSchema } from '@fuzl/planning';
import type { AIConfiguration, AIProvider, AnalysisRequest, AnalysisResponse } from '@fuzl/planning';

export function sameAnalysisSource(request: AnalysisRequest, draft: string, referenceDate: string | null, provider?: AIProvider): boolean {
  return request.conversation === draft && request.referenceDate === referenceDate &&
    (provider === undefined || request.expectedProvider === undefined || request.expectedProvider === provider);
}

export async function fetchAIConfiguration(signal: AbortSignal): Promise<AIConfiguration> {
  const response = await fetch('/api/ai-config', { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]), cache: 'no-store' });
  if (!response.ok) throw new Error('Could not read the selected provider. Check AI_PROVIDER on the backend, then reload the configuration.');
  const result = aiConfigurationSchema.safeParse(await response.json());
  if (!result.success) throw new Error('The API returned an invalid provider configuration. Analysis was not enabled.');
  return result.data;
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
  if (request.expectedProvider && result.data.metrics.provider !== request.expectedProvider) throw new Error('The response provider does not match your submission. Your existing work was kept.');
  return result.data;
}
