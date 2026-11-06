import { z } from 'zod';
import { GEMINI_MODEL, MAX_OUTPUT_TOKENS, PROVIDER_TIMEOUT_MS } from '@fuzl/planning';
import type { AnalysisRequest, AnalysisResponse } from '@fuzl/planning';
import { extractionInstructions } from './prompt.js';
import { ExtractionError, invalidOutput } from './errors.js';
import { validateExtraction } from './validate.js';
import { convertGeminiOutput, geminiFormatInstructions, geminiResponseSchema } from './gemini-schema.js';

const envelopeSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z.array(z.object({
    finishReason: z.string(),
    content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }).optional(),
  })).optional(),
  usageMetadata: z.object({
    promptTokenCount: z.number().int().nonnegative().optional(), candidatesTokenCount: z.number().int().nonnegative().optional(),
    thoughtsTokenCount: z.number().int().nonnegative().optional(),
  }).optional(),
});

export async function extractWithGemini(request: AnalysisRequest, signal: AbortSignal, apiKey: string): Promise<AnalysisResponse> {
  const started = performance.now();
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(PROVIDER_TIMEOUT_MS)]);
  try {
    // Fixed host, key in a header (never URL/prompt), no redirects/tools/retries.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST', redirect: 'error', signal: deadline,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${extractionInstructions}\n${geminiFormatInstructions}` }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ untrustedConversation: request.conversation, referenceDate: request.referenceDate }) }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: geminiResponseSchema, maxOutputTokens: MAX_OUTPUT_TOKENS, candidateCount: 1 },
      }),
    });
    if (response.status === 429) throw new ExtractionError(429, 'provider_limit', 'Gemini quota or rate limit reached. Check this project’s Free Tier model limits in Google AI Studio and retry manually after the appropriate reset. No other provider was called.');
    if (response.status === 401 || response.status === 403) throw new ExtractionError(503, 'provider_access', 'Gemini rejected access. Check the backend Gemini key, project verification, region eligibility, and model access in AI Studio. Fuzl has not enabled billing or changed providers.');
    if (response.status === 404) throw new ExtractionError(503, 'model_unavailable', 'The selected Gemini model is unavailable for this project. Check model access in AI Studio. No fallback provider was called.');
    if (response.status === 400) throw new ExtractionError(502, 'provider_request', 'Gemini rejected the request or structured-output schema. Use manual entry and check model/schema compatibility. No fallback provider was called.');
    if (!response.ok) throw new ExtractionError(502, 'provider_failure', 'Gemini could not complete this request. Retry later or use manual entry. No fallback provider was called.');
    const rawEnvelope: unknown = await response.json().catch(() => invalidOutput());
    const parsed = envelopeSchema.safeParse(rawEnvelope);
    if (!parsed.success) invalidOutput();
    const envelope = parsed.data;
    const candidate = envelope.candidates?.[0];
    if (envelope.promptFeedback?.blockReason || envelope.candidates?.length !== 1 || candidate?.finishReason !== 'STOP' || !candidate.content) {
      throw new ExtractionError(502, 'incomplete_output', 'Gemini returned a blocked or incomplete extraction. Your previous summary was kept; try shorter synthetic text or manual entry.');
    }
    const parts = candidate.content.parts.filter((part) => !part.thought);
    if (parts.length === 0 || parts.some((part) => typeof part.text !== 'string')) invalidOutput();
    let raw: unknown;
    try { raw = JSON.parse(parts.map((part) => part.text).join('')); } catch { invalidOutput(); }
    const result = validateExtraction(convertGeminiOutput(raw), request);
    const inputTokens = envelope.usageMetadata?.promptTokenCount ?? null;
    const candidateTokens = envelope.usageMetadata?.candidatesTokenCount;
    const outputTokens = candidateTokens === undefined ? null : candidateTokens + (envelope.usageMetadata?.thoughtsTokenCount ?? 0);
    return { ...result, metrics: {
      provider: 'gemini', model: GEMINI_MODEL, latencyMs: Math.round(performance.now() - started), inputTokens, outputTokens,
      // The API key's billing tier is not known to Fuzl. Never label usage as $0.
      estimatedCostUsd: null,
    } };
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    if (deadline.aborted) throw new ExtractionError(504, 'analysis_timeout', 'Gemini analysis timed out or was cancelled. Your previous summary was kept. Retry explicitly.');
    throw new ExtractionError(502, 'provider_failure', 'Gemini could not complete this request. Check the connection or use manual entry. No fallback provider was called.');
  }
}
