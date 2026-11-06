import type { AnalysisRequest, AnalysisResponse } from '@fuzl/planning';
import { ensureAIConfigured } from './configuration.js';
import { extractWithOpenAI } from './openai.js';
import { extractWithGemini } from './gemini.js';
import { ExtractionError } from './errors.js';

export { ensureAIConfigured } from './configuration.js';

export async function extractConversation(request: AnalysisRequest, signal: AbortSignal): Promise<AnalysisResponse> {
  const configuration = ensureAIConfigured();
  if (request.expectedProvider && request.expectedProvider !== configuration.provider) {
    throw new ExtractionError(409, 'provider_changed', 'The configured AI provider changed. Reload the page, read the updated disclosure, and submit again. No provider was called.');
  }
  return configuration.provider === 'gemini'
    ? extractWithGemini(request, signal, configuration.apiKey)
    : extractWithOpenAI(request, signal, configuration.apiKey);
}
