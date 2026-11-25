import { aiConfigurationSchema, analysisRequestSchema, analysisResponseSchema } from '@fuzl/planning';
import type { AIConfiguration, AIProvider, AnalysisRequest, AnalysisResponse } from '@fuzl/planning';

export class AnalysisRequestError extends Error {
  constructor(readonly status: number, readonly code: string | null, readonly userMessage: string, readonly reference: string | null) {
    super(userMessage + (reference ? ` Error reference: ${reference}.` : ''));
    this.name = 'AnalysisRequestError';
  }
}

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

export async function analyzeConversation(request: AnalysisRequest, signal: AbortSignal, makePlan = false): Promise<AnalysisResponse> {
  if (!analysisRequestSchema.safeParse(request).success) throw new Error('Use 1–6000 characters and a valid optional reference date.');
  const response = await fetch(makePlan ? '/api/make-plan' : '/api/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]), cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => { throw new Error('The API returned an unreadable response. Check the API connection and retry.'); });
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' &&
      body.error !== null && 'message' in body.error && typeof body.error.message === 'string' ? body.error.message : `Analysis failed (HTTP ${response.status}). Retry later or use manual entry.`;
    const reference = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' && body.error !== null &&
      'reference' in body.error && typeof body.error.reference === 'string' && /^[0-9a-f-]{36}$/.test(body.error.reference) ? body.error.reference : null;
    const code = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' && body.error !== null &&
      'code' in body.error && typeof body.error.code === 'string' && /^[a-z_]{1,60}$/.test(body.error.code) ? body.error.code : null;
    throw new AnalysisRequestError(response.status, code, message, reference);
  }
  const result = analysisResponseSchema.safeParse(body);
  if (!result.success) throw new Error('The API returned an invalid summary. Your existing work was kept.');
  if (makePlan && !result.data.proposal) throw new Error('The API returned no plan. Your existing work was kept.');
  if (request.expectedProvider && result.data.metrics.provider !== request.expectedProvider) throw new Error('The response provider does not match your submission. Your existing work was kept.');
  return result.data;
}
