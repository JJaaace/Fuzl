import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { MODEL, MAX_OUTPUT_TOKENS, PROVIDER_TIMEOUT_MS, providerOutputSchema } from '@fuzl/planning';
import type { AnalysisRequest, AnalysisResponse } from '@fuzl/planning';
import { extractionInstructions } from './prompt.js';
import { ExtractionError, invalidOutput } from './errors.js';
import { validateExtraction } from './validate.js';

export function ensureAIConfigured() {
  if (!process.env.OPENAI_API_KEY?.trim() || process.env.AI_ENABLED !== 'true') {
    throw new ExtractionError(503, 'ai_not_configured', 'AI analysis is not configured. Set OPENAI_API_KEY and AI_ENABLED=true in apps/api/.env, then restart the API. Samples and manual entry still work.');
  }
}

export async function extractConversation(request: AnalysisRequest, signal: AbortSignal): Promise<AnalysisResponse> {
  ensureAIConfigured();
  const started = performance.now();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: 'https://api.openai.com/v1', maxRetries: 0, timeout: PROVIDER_TIMEOUT_MS, logLevel: 'off' });
  try {
    const response = await client.responses.create({
      model: MODEL, store: false, background: false, max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: 'none' },
      instructions: extractionInstructions,
      input: [{ role: 'user', content: JSON.stringify({ untrustedConversation: request.conversation, referenceDate: request.referenceDate }) }],
      text: { format: zodTextFormat(providerOutputSchema, 'planning_extraction') },
    }, { signal });
    if (response.status !== 'completed' || response.output.some((item) => item.type === 'message' && item.content.some((part) => part.type === 'refusal'))) {
      throw new ExtractionError(502, 'incomplete_output', 'The AI did not complete a usable extraction. Try a shorter conversation or use manual entry.');
    }
    let raw: unknown;
    try { raw = JSON.parse(response.output_text); } catch { invalidOutput(); }
    const result = validateExtraction(raw, request);
    const inputTokens = response.usage?.input_tokens ?? null;
    const outputTokens = response.usage?.output_tokens ?? null;
    return { ...result, metrics: {
      model: MODEL, latencyMs: Math.round(performance.now() - started), inputTokens, outputTokens,
      // Conservative estimate ignores discounted cached input; not a billing record.
      estimatedCostUsd: inputTokens === null || outputTokens === null ? null : (inputTokens * 0.75 + outputTokens * 4.5) / 1_000_000,
    } };
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new ExtractionError(504, 'analysis_timeout', 'Analysis timed out or was cancelled. Your previous summary was kept. You can retry explicitly.');
    }
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) {
      throw new ExtractionError(503, 'provider_access', 'The provider rejected access. Check the backend key and model access in your OpenAI project.');
    }
    if (error instanceof OpenAI.APIError && error.status === 429) {
      throw new ExtractionError(429, 'provider_limit', 'The AI provider reached a rate or quota limit. Check the project budget and retry later.');
    }
    throw new ExtractionError(502, 'provider_failure', 'The AI provider could not complete this request. Check backend configuration or retry later; manual entry still works.');
  }
}
