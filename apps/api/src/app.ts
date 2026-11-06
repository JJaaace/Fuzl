import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { analysisRequestSchema, analysisResponseSchema, PROVIDER_TIMEOUT_MS } from '@fuzl/planning';
import type { AnalysisRequest, AnalysisResponse } from '@fuzl/planning';
import { ensureAIConfigured, extractConversation } from './extraction/provider.js';
import { ExtractionError, invalidOutput } from './extraction/errors.js';
import { getAIConfiguration } from './extraction/configuration.js';

type Extractor = (request: AnalysisRequest, signal: AbortSignal) => Promise<AnalysisResponse>;
export function createApp(options: { extract?: Extractor; checkConfiguration?: () => void; now?: () => number; timeoutMs?: number } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const extract = options.extract ?? extractConversation;
  const checkConfiguration = options.checkConfiguration ?? ensureAIConfigured;
  const now = options.now ?? Date.now;
  let attempts = 0;
  let active = false;
  let recentAttempts: number[] = [];

  app.get('/api/health', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.json({ status: 'ok', service: 'fuzl-api' });
  });
  app.get('/api/ai-config', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.json(getAIConfiguration()); // Public allowlist: provider/model only.
  });

  app.post('/api/analyze', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    const origin = request.get('origin');
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
      throw new ExtractionError(403, 'origin_rejected', 'Analysis is available only from this local development app.');
    }
    if (!request.is('application/json')) throw new ExtractionError(415, 'json_required', 'Send the conversation as JSON.');
    next();
  }, express.json({ limit: '32kb' }), async (request, response, next) => {
    const parsed = analysisRequestSchema.safeParse(request.body);
    if (!parsed.success) return next(new ExtractionError(400, 'invalid_input', 'Enter 1–6000 characters and an optional valid reference date (YYYY-MM-DD).'));
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let acquired = false;
    const disconnected = () => { if (!response.writableEnded) controller?.abort(); };
    try {
      if (parsed.data.expectedProvider && parsed.data.expectedProvider !== getAIConfiguration().provider) {
        throw new ExtractionError(409, 'provider_changed', 'The configured AI provider changed. Reload the page and read its disclosure before submitting again. No provider was called.');
      }
      checkConfiguration();
      recentAttempts = recentAttempts.filter((time) => time > now() - 60_000);
      if (active) throw new ExtractionError(429, 'analysis_busy', 'An analysis is already running. Wait for it to finish before retrying.');
      if (attempts >= 10) throw new ExtractionError(429, 'session_limit', 'The 10-attempt development limit was reached. Review usage and budget before restarting the API.');
      if (recentAttempts.length >= 3) {
        response.set('Retry-After', '60');
        throw new ExtractionError(429, 'rate_limit', 'The local limit is three analyses per minute. Wait one minute before retrying.');
      }
      active = acquired = true;
      attempts += 1;
      recentAttempts.push(now());
      controller = new AbortController();
      response.once('close', disconnected);
      const abort = new Promise<never>((_resolve, reject) => {
        controller!.signal.addEventListener('abort', () => reject(new ExtractionError(504, 'analysis_timeout', 'Analysis timed out or was cancelled. Retry explicitly or use manual entry.')), { once: true });
      });
      timer = setTimeout(() => controller!.abort(), options.timeoutMs ?? PROVIDER_TIMEOUT_MS);
      const result = await Promise.race([extract(parsed.data, controller.signal), abort]);
      const valid = analysisResponseSchema.safeParse(result);
      if (!valid.success) invalidOutput();
      if (!response.destroyed) response.json(valid.data);
    } catch (error) { if (!response.destroyed) next(error); }
    finally {
      if (timer) clearTimeout(timer);
      response.off('close', disconnected);
      if (acquired) active = false;
    }
  });

  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    void _next; // Four arguments select Express's error-handler middleware.
    if (error instanceof ExtractionError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const tooLarge = typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large';
    const malformed = typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.parse.failed';
    response.status(tooLarge ? 413 : malformed ? 400 : 500).json({ error: {
      code: tooLarge ? 'input_too_large' : malformed ? 'invalid_request' : 'internal_error',
      message: tooLarge ? 'The request exceeds the 32 KB limit. Use a shorter conversation.' : malformed ? 'The request could not be read. Check the input and try again.' : 'The API could not complete analysis. Your existing summary was kept. Retry later or use manual entry.',
    } });
  };
  app.use(errors);
  return app;
}

export const app = createApp();
