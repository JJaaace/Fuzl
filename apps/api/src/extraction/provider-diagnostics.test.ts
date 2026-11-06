import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import { extractConversation } from './provider.js';
import { ExtractionError, invalidOutput } from './errors.js';
import { httpFailure, exceptionFailure } from './provider-diagnostics.js';
import { evaluationCases } from './cases.js';
import { createApp } from '../app.js';

function configured(t: TestContext) {
  for (const [key, value] of Object.entries({ AI_PROVIDER: 'gemini', AI_ENABLED: 'true', GEMINI_API_KEY: 'test-private-key' })) {
    const old = process.env[key]; process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
}

test('HTTP failure retains status and recognized provider code/message without arbitrary provider text', () => {
  const raw = { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. https://example.com?key=test-private-key Alex: private conversation' } };
  const result = httpFailure(400, raw);
  assert.equal(result.category, 'provider_http'); assert.equal(result.upstreamStatus, 400);
  assert.equal(result.upstreamCode, 'INVALID_ARGUMENT'); assert.equal(result.upstreamMessage, 'Google rejected the API key.');
  const serialized = JSON.stringify(result);
  for (const secret of ['test-private-key', 'example.com', 'private conversation', 'Alex:']) assert.ok(!serialized.includes(secret));
  const unknown = httpFailure(500, { error: { status: 'test-private-key', message: 'unrecognized private conversation' } });
  assert.equal(unknown.upstreamCode, 'UNKNOWN');
  assert.ok(!JSON.stringify(unknown).includes('private conversation'));
  assert.equal(httpFailure(402, {}).action, 'billing_required_stop');
  assert.equal(httpFailure(400, { error: { status: 'FAILED_PRECONDITION' } }).action, 'account_prerequisite_stop');
  assert.equal(httpFailure(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded, limit: 0' } }).action, 'check_free_quota');
});

test('transport diagnostics preserve known cause codes without messages, headers, URLs, or arbitrary stacks', () => {
  const error = new TypeError('https://example.com?key=test-private-key private conversation', { cause: Object.assign(new Error('Authorization: secret'), { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' }) });
  const result = exceptionFailure(error, 'request_send', false);
  assert.equal(result.category, 'network'); assert.equal(result.transportCode, 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY');
  assert.equal(result.action, 'check_tls_trust');
  assert.ok(!JSON.stringify(result).includes('example.com'));
  assert.ok(!JSON.stringify(result).includes('Authorization'));
  const unexpected = exceptionFailure(new ReferenceError('private-conversation secret'), 'wire_conversion', false);
  assert.equal(unexpected.category, 'unexpected_adapter'); assert.equal(unexpected.exceptionType, 'ReferenceError');
  assert.ok(!JSON.stringify(unexpected).includes('private-conversation'));
});

test('HTTP, network, timeout, cancellation, malformed responses, and adapter bugs remain distinct', async (t) => {
  configured(t);
  await t.test('HTTP 503', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { status: 'UNAVAILABLE', message: 'Service unavailable' } }, { status: 503 }));
    await assert.rejects(extractConversation(evaluationCases[1].request, new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof ExtractionError); assert.equal(error.code, 'provider_http_error');
      assert.equal(error.serverFailure?.upstreamStatus, 503); assert.equal(error.serverFailure.upstreamCode, 'UNAVAILABLE');
      return true;
    });
  });
  await t.test('network', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET', message: 'private' } }); });
    await assert.rejects(extractConversation(evaluationCases[1].request, new AbortController().signal), (error: unknown) => error instanceof ExtractionError && error.code === 'provider_network' && error.serverFailure?.transportCode === 'ECONNRESET');
  });
  await t.test('unexpected adapter exception', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { throw new ReferenceError('sensitive details'); });
    await assert.rejects(extractConversation(evaluationCases[1].request, new AbortController().signal), (error: unknown) => error instanceof ExtractionError && error.code === 'adapter_error' && error.serverFailure?.category === 'unexpected_adapter' && !error.message.includes('sensitive'));
  });
  for (const reason of ['TimeoutError', 'AbortError'] as const) {
    await t.test(reason, async (t) => {
      t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal!.addEventListener('abort', () => reject(options.signal!.reason), { once: true })));
      const controller = new AbortController(); const request = extractConversation(evaluationCases[1].request, controller.signal);
      controller.abort(new DOMException('private details', reason));
      await assert.rejects(request, (error: unknown) => error instanceof ExtractionError && error.serverFailure?.category === (reason === 'TimeoutError' ? 'timeout' : 'cancelled'));
    });
  }
  await t.test('malformed response JSON', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('not JSON'));
    await assert.rejects(extractConversation(evaluationCases[1].request, new AbortController().signal), (error: unknown) => error instanceof ExtractionError && error.serverFailure?.category === 'response_parsing' && error.diagnostic?.rule === 'invalid_json');
  });
});

test('HTTP API keeps detailed diagnostics in server logs and exposes only useful message/reference', async (t) => {
  const logged: string[] = [];
  t.mock.method(console, 'error', (message: string) => logged.push(message));
  const app = createApp({ checkConfiguration: () => {}, extract: async () => invalidOutput('source_validation', ['sources', 0, 'text'], 'quote_not_exact') });
  const listener = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => listener.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => listener.close(() => resolve())));
  const response = await fetch(`http://127.0.0.1:${(listener.address() as AddressInfo).port}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evaluationCases[1].request) });
  const result = await response.json() as { error: Record<string, unknown> };
  assert.equal(response.status, 502); assert.equal(result.error.diagnostic, undefined); assert.equal(result.error.serverFailure, undefined);
  assert.equal(typeof result.error.reference, 'string'); assert.ok(!String(result.error.message).includes('sources[0]'));
  const log = JSON.parse(logged[0]);
  assert.equal(log.reference, result.error.reference);
  assert.deepEqual(log.validation, { stage: 'source_validation', path: 'sources[0].text', rule: 'quote_not_exact' });
});

test('API deadline keeps its timeout classification even when a provider does not settle', async (t) => {
  const logged: string[] = [];
  t.mock.method(console, 'error', (message: string) => logged.push(message));
  const app = createApp({ checkConfiguration: () => {}, timeoutMs: 10, extract: async () => new Promise(() => {}) });
  const listener = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => listener.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => listener.close(() => resolve())));
  const response = await fetch(`http://127.0.0.1:${(listener.address() as AddressInfo).port}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evaluationCases[1].request) });
  assert.equal(response.status, 504);
  const result = await response.json() as { error: { code: string; reference: string } };
  assert.equal(result.error.code, 'analysis_timeout');
  assert.equal(JSON.parse(logged[0]).category, 'timeout');
  assert.equal(JSON.parse(logged[0]).reference, result.error.reference);
});
