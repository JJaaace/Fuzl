import { z } from 'zod';
import { GEMINI_MODEL, MAX_OUTPUT_TOKENS, PROVIDER_TIMEOUT_MS } from '@fuzl/planning';
import type { AnalysisRequest, AnalysisResponse } from '@fuzl/planning';
import { extractionInstructions } from './prompt.js';
import { ExtractionError, invalidOutput, schemaFailure, validationDiagnostic } from './errors.js';
import { validateExtraction } from './validate.js';
import { convertGeminiOutput, geminiFormatInstructions, geminiSchemaForConversation } from './gemini-schema.js';
import { exceptionFailure, httpFailure } from './provider-diagnostics.js';
import type { Operation, ServerFailure } from './provider-diagnostics.js';

function upstreamError(details: ServerFailure): ExtractionError {
  const status = details.upstreamStatus;
  if (details.action === 'billing_required_stop' || details.action === 'account_prerequisite_stop') return new ExtractionError(503, 'provider_account_action', 'Google requires a billing or account prerequisite. Stop free testing and inspect your AI Studio project; Fuzl will not enable billing or switch providers.', undefined, details);
  if (status === 429) return new ExtractionError(429, 'provider_limit', 'Gemini quota or rate limit reached. Check this project’s Free Tier limits in Google AI Studio. No other provider was called; no retry ran.', undefined, details);
  if (status === 401 || status === 403) return new ExtractionError(503, 'provider_access', 'Google rejected access. Check the Gemini key, project verification, region, and permissions in AI Studio. No billing or provider change was made.', undefined, details);
  if (status === 404) return new ExtractionError(503, 'model_unavailable', 'The configured Gemini model or method is unavailable. Check model access before another request. No fallback was called.', undefined, details);
  if (status === 400) return new ExtractionError(502, 'provider_request', 'Google rejected the extraction request or schema. Your summary was kept; inspect the server diagnostic using this error reference.', undefined, details);
  return new ExtractionError(502, 'provider_http_error', 'Google returned a service error. Your summary was kept. Inspect the server diagnostic before another request.', undefined, details);
}

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

export async function generateGeminiJson<T>(input: { system: string; parts: unknown[]; schema: unknown }, signal: AbortSignal, apiKey: string,
  validate: (raw: unknown, operation: (value: Operation) => void) => T): Promise<{ result: T; metrics: AnalysisResponse['metrics'] }> {
  const started = performance.now();
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(PROVIDER_TIMEOUT_MS)]);
  let operation: Operation = 'request_build';
  let upstreamStatus: number | undefined;
  try {
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: input.parts }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: input.schema, maxOutputTokens: MAX_OUTPUT_TOKENS, candidateCount: 1 },
    });
    if (Buffer.byteLength(body) > 20_000_000) throw new ExtractionError(413, 'provider_request_size', 'The combined request exceeds Gemini’s 20 MB inline limit after encoding. Remove or resize screenshots; no provider request was sent.');
    // Fixed host, key in a header (never URL/prompt), no redirects/tools/retries.
    operation = 'request_send';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST', redirect: 'error', signal: deadline,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body,
    });
    operation = 'http_response';
    upstreamStatus = response.status;
    if (!response.ok) {
      // Read only for allowlisted technical interpretation; never return/log body.
      const errorBody: unknown = await response.json().catch(() => null);
      throw upstreamError(httpFailure(response.status, errorBody));
    }
    operation = 'response_envelope';
    let rawEnvelope: unknown;
    try { rawEnvelope = await response.json(); }
    catch (error) {
      if (error instanceof SyntaxError) invalidOutput('provider_envelope', [], 'invalid_json');
      throw error;
    }
    const parsed = envelopeSchema.safeParse(rawEnvelope);
    if (!parsed.success) schemaFailure('provider_envelope', parsed.error);
    const envelope = parsed.data;
    const candidate = envelope.candidates?.[0];
    const incomplete = envelope.promptFeedback?.blockReason
      ? validationDiagnostic('provider_envelope', ['promptFeedback', 'blockReason'], 'blocked_response')
      : envelope.candidates?.length !== 1
        ? validationDiagnostic('provider_envelope', ['candidates'], 'unexpected_candidate_count')
        : candidate?.finishReason !== 'STOP'
          ? validationDiagnostic('provider_envelope', ['candidates', 0, 'finishReason'], candidate?.finishReason === 'MAX_TOKENS' ? 'truncated_response' : 'incomplete_response')
          : !candidate.content ? validationDiagnostic('provider_envelope', ['candidates', 0, 'content'], 'missing_content') : null;
    if (incomplete) throw new ExtractionError(502, 'incomplete_output', 'Gemini returned a blocked or incomplete extraction. Your previous summary was kept.', incomplete);
    if (!candidate?.content) invalidOutput('provider_envelope', ['candidates', 0, 'content'], 'missing_content');
    const parts = candidate.content.parts.filter((part) => !part.thought);
    if (parts.length === 0 || parts.some((part) => typeof part.text !== 'string')) invalidOutput('provider_envelope', ['candidates', 0, 'content', 'parts'], 'missing_text');
    let raw: unknown;
    operation = 'response_json';
    try { raw = JSON.parse(parts.map((part) => part.text).join('')); } catch { invalidOutput('provider_json', [], 'invalid_json'); }
    const result = validate(raw, (value) => { operation = value; });
    const inputTokens = envelope.usageMetadata?.promptTokenCount ?? null;
    const candidateTokens = envelope.usageMetadata?.candidatesTokenCount;
    const outputTokens = candidateTokens === undefined ? null : candidateTokens + (envelope.usageMetadata?.thoughtsTokenCount ?? 0);
    return { result, metrics: {
      provider: 'gemini', model: GEMINI_MODEL, latencyMs: Math.round(performance.now() - started), inputTokens, outputTokens,
      // The API key's billing tier is not known to Fuzl. Never label usage as $0.
      estimatedCostUsd: null,
    } };
  } catch (error) {
    if (error instanceof ExtractionError) {
      if (!error.serverFailure) error.serverFailure = {
        category: error.diagnostic?.stage === 'provider_envelope' || error.diagnostic?.stage === 'provider_json' ? 'response_parsing' : 'validation',
        operation, ...(error.diagnostic ? { validation: error.diagnostic } : {}),
        ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
      };
      throw error;
    }
    const cancelled = signal.aborted && !(signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError');
    const details = exceptionFailure(error, operation, deadline.aborted, cancelled);
    if (details.category === 'cancelled') throw new ExtractionError(499, 'analysis_cancelled', 'Gemini analysis was cancelled. Your summary was kept.', undefined, details);
    if (details.category === 'timeout') throw new ExtractionError(504, 'analysis_timeout', 'Gemini analysis exceeded its deadline. Your summary was kept.', undefined, details);
    if (details.category === 'network') throw new ExtractionError(502, 'provider_network', details.action === 'check_tls_trust'
      ? 'A secure connection to Gemini could not be established. Check the server’s certificate trust. Your summary was kept.'
      : 'The server could not connect to Gemini. Check the server network; your summary was kept.', undefined, details);
    throw new ExtractionError(500, 'adapter_error', 'An internal Gemini adapter error prevented extraction. Your summary was kept; inspect the server error reference.', undefined, details);
  }
}

export async function extractWithGemini(request: AnalysisRequest, signal: AbortSignal, apiKey: string): Promise<AnalysisResponse> {
  const response = await generateGeminiJson({
    system: `${extractionInstructions}\n${geminiFormatInstructions}`,
    parts: [{ text: JSON.stringify({ untrustedConversation: request.conversation, referenceDate: request.referenceDate }) }],
    schema: geminiSchemaForConversation(request.conversation),
  }, signal, apiKey, (raw, operation) => {
    operation('wire_conversion');
    const converted = convertGeminiOutput(raw);
    operation('source_validation');
    return validateExtraction(converted, request);
  });
  return { ...response.result, metrics: response.metrics };
}
