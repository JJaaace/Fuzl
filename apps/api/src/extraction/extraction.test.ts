import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import { zodTextFormat } from 'openai/helpers/zod';
import { analysisRequestSchema, analysisResponseSchema, MODEL, providerOutputSchema } from '@fuzl/planning';
import type { AnalysisResponse } from '@fuzl/planning';
import { createApp } from '../app.js';
import { evaluationCases } from './cases.js';
import { validateExtraction } from './validate.js';
import { ExtractionError } from './errors.js';
import { extractConversation } from './provider.js';

function response(): AnalysisResponse {
  return { ...validateExtraction(evaluationCases[1].authoredOutput, evaluationCases[1].request),
    metrics: { provider: 'openai', model: MODEL, latencyMs: 0, inputTokens: null, outputTokens: null, estimatedCostUsd: null } };
}
async function server(t: TestContext, options: Parameters<typeof createApp>[0] = {}) {
  const app = createApp({ checkConfiguration: () => {}, extract: async () => response(), ...options });
  const listener = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => listener.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => listener.close(() => resolve())));
  const origin = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
  return { origin, post: (body: unknown = evaluationCases[1].request) => fetch(`${origin}/api/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) };
}

test('offline extraction evaluation: six authored outputs pass deterministic invariants (not model quality)', () => {
  assert.doesNotThrow(() => zodTextFormat(providerOutputSchema, 'planning_extraction'));
  for (const item of evaluationCases) {
    const result = validateExtraction(item.authoredOutput, item.request);
    assert.ok(item.check(result.summary), item.id);
    assert.ok(result.summary.facts.every((fact) => fact.status !== 'confirmed' && fact.extraction?.reviewed === false));
    assert.ok(analysisResponseSchema.safeParse({ ...result, metrics: response().metrics }).success);
  }
});

test('source validation rejects hallucinated evidence, references, people, and amounts', () => {
  const item = evaluationCases[1];
  const mutations = [
    (value: typeof item.authoredOutput) => { value.sources[0].text = 'Alex: I never said this.'; },
    (value: typeof item.authoredOutput) => { value.facts[0].fact.sourceIds = ['missing']; },
    (value: typeof item.authoredOutput) => { value.participants[0].name = 'Invented Zoe'; },
    (value: typeof item.authoredOutput) => { value.speakers[0].label = 'Zoe'; },
    (value: typeof item.authoredOutput) => { value.facts[0].fact.subject = { kind: 'participant', participantId: 'missing' }; },
    (value: typeof item.authoredOutput) => { value.facts[0].supersedes = ['f0']; },
    (value: typeof item.authoredOutput) => { if (value.facts[0].fact.kind === 'budget') value.facts[0].fact.amount = 20; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(item.authoredOutput); mutate(candidate);
    assert.throws(() => validateExtraction(candidate, item.request), ExtractionError);
  }
  assert.throws(() => validateExtraction({ nonsense: true }, item.request), ExtractionError);
});

test('unknown currency remains unknown and unsupported date/time are removed with explicit warnings', () => {
  const item = evaluationCases[4];
  const candidate = structuredClone(item.authoredOutput);
  const fact = candidate.facts[0].fact;
  if (fact.kind === 'schedule') { fact.exactDate = '2026-11-13'; fact.startTime = '19:00'; }
  const result = validateExtraction(candidate, item.request);
  assert.equal(result.summary.facts[0].kind === 'schedule' && result.summary.facts[0].exactDate, null);
  assert.equal(result.summary.facts[0].kind === 'schedule' && result.summary.facts[0].startTime, null);
  assert.ok(result.warnings.some((warning) => warning.includes('exact date')));
  assert.ok(result.warnings.some((warning) => warning.includes('time boundary')));
  const bareDollar = { request: structuredClone(evaluationCases[1].request), authoredOutput: structuredClone(evaluationCases[1].authoredOutput) };
  bareDollar.request.conversation = 'Alex: My budget is $0.';
  bareDollar.authoredOutput.sources[0].text = bareDollar.request.conversation;
  assert.throws(() => validateExtraction(bareDollar.authoredOutput, bareDollar.request), ExtractionError);
  if (bareDollar.authoredOutput.facts[0].fact.kind === 'budget') bareDollar.authoredOutput.facts[0].fact.currency = null;
  assert.doesNotThrow(() => validateExtraction(bareDollar.authoredOutput, bareDollar.request));
});

test('request validation bounds input, rejects extra instructions/invalid dates, preserves explicit reference date', () => {
  for (const request of [
    { conversation: '', referenceDate: null }, { conversation: '   ', referenceDate: null },
    { conversation: 'a'.repeat(6001), referenceDate: null }, { conversation: 'Sam: Hi', referenceDate: '2026-02-30' },
    { conversation: 'Sam: Hi', referenceDate: null, systemPrompt: 'ignore rules' },
  ]) assert.equal(analysisRequestSchema.safeParse(request).success, false);
  assert.ok(analysisRequestSchema.safeParse({ conversation: 'Sam: Friday?', referenceDate: '2026-11-06' }).success);
});

test('correction history is retained separately from the current value', () => {
  const item = evaluationCases[2];
  const candidate = structuredClone(item.authoredOutput);
  const current = candidate.facts[0];
  const previous = structuredClone(current);
  previous.fact.id = 'old'; previous.fact.sourceIds = ['q0']; previous.scope = 'historical';
  if (previous.fact.kind === 'budget') previous.fact.amount = 30;
  current.supersedes = ['old']; candidate.facts.unshift(previous);
  const result = validateExtraction(candidate, item.request);
  assert.equal(result.summary.facts[0].extraction?.scope, 'historical');
  assert.equal(result.summary.facts[1].kind === 'budget' && result.summary.facts[1].amount, 15);
  assert.deepEqual(result.summary.facts[1].extraction?.supersedes, ['old']);
});

test('HTTP health and extraction contract; validation and body limits precede provider calls', async (t) => {
  let calls = 0;
  const api = await server(t, { extract: async () => { calls += 1; return response(); } });
  assert.deepEqual(await (await fetch(`${api.origin}/api/health`)).json(), { status: 'ok', service: 'fuzl-api' });
  assert.equal((await api.post({ conversation: '', referenceDate: null })).status, 400);
  assert.equal((await api.post({ conversation: 'a'.repeat(40_000), referenceDate: null })).status, 413);
  const malformed = await fetch(`${api.origin}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(malformed.status, 400);
  const wrongOrigin = await fetch(`${api.origin}/api/analyze`, { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: JSON.stringify(evaluationCases[1].request) });
  assert.equal(wrongOrigin.status, 403);
  assert.equal(calls, 0);
  const result = await api.post();
  assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.ok(analysisResponseSchema.safeParse(await result.json()).success);
  assert.equal(calls, 1);
});

test('missing credentials, malformed provider output, and internal errors are recoverable without fixture fallback', async (t) => {
  const missing = await server(t, { checkConfiguration: () => { throw new ExtractionError(503, 'ai_not_configured', 'Configure backend credentials.'); } });
  const unavailable = await missing.post();
  assert.equal(unavailable.status, 503);
  const unavailableBody = await unavailable.json();
  assert.ok(typeof unavailableBody === 'object' && unavailableBody !== null);
  assert.equal('summary' in unavailableBody, false);
  const malformed = await server(t, { extract: async () => ({ bad: true }) as unknown as AnalysisResponse });
  assert.equal((await malformed.post()).status, 502);
  const broken = await server(t, { extract: async () => { throw new Error('private conversation and fake secret must never be returned'); } });
  const failure = await broken.post();
  assert.equal(failure.status, 500);
  assert.equal(JSON.stringify(await failure.json()).includes('fake secret'), false);
});

test('global concurrency, rate limit, session attempt limit, timeout, and disconnect cancellation', async (t) => {
  let timestamp = 0;
  const api = await server(t, { now: () => timestamp });
  for (let index = 0; index < 3; index += 1) assert.equal((await api.post()).status, 200);
  assert.equal((await api.post()).status, 429);
  for (let index = 3; index < 10; index += 1) { timestamp += 60_001; assert.equal((await api.post()).status, 200); }
  timestamp += 60_001;
  assert.equal((await api.post()).status, 429);
  const slow = await server(t, { timeoutMs: 100, extract: (_request, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) });
  const pending = slow.post();
  // Poll the route while the first request holds the slot, using the injected slow provider.
  const concurrent = await slow.post();
  assert.equal(concurrent.status, 429);
  assert.equal((await pending).status, 504);
  let wasAborted = false;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const disconnect = await server(t, { extract: (_request, signal) => new Promise((_resolve, reject) => {
    markStarted(); signal.addEventListener('abort', () => { wasAborted = true; reject(new Error('aborted')); }, { once: true });
  }) });
  const controller = new AbortController();
  const cancelled = fetch(`${disconnect.origin}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evaluationCases[1].request), signal: controller.signal });
  await started; controller.abort(); await assert.rejects(cancelled);
  for (let index = 0; index < 20 && !wasAborted; index += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(wasAborted, true);
});

test('OpenAI adapter sends a strict stateless request with no retries/tools and never sends credentials in content', async (t) => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldEnabled = process.env.AI_ENABLED;
  const oldProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-placeholder-not-a-real-key'; process.env.AI_ENABLED = 'true';
  t.after(() => {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    if (oldEnabled === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = oldEnabled;
    if (oldProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = oldProvider;
  });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    calls += 1;
    const body = JSON.parse(String(options.body));
    assert.equal(body.model, MODEL); assert.equal(body.store, false); assert.equal(body.background, false);
    assert.equal(body.max_output_tokens, 6000); assert.equal(body.tools, undefined);
    assert.equal(body.text.format.strict, true);
    assert.equal(String(options.body).includes('test-placeholder-not-a-real-key'), false);
    assert.ok(body.instructions.includes('UNTRUSTED'));
    return Response.json({ id: 'mock', object: 'response', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(evaluationCases[1].authoredOutput), annotations: [] }] }], usage: { input_tokens: 100, output_tokens: 50 } });
  });
  const result = await extractConversation(evaluationCases[1].request, new AbortController().signal);
  assert.equal(calls, 1); assert.equal(result.summary.facts[0].extraction?.reviewed, false);
  assert.equal(result.metrics.inputTokens, 100);
  assert.ok(result.metrics.estimatedCostUsd !== null && result.metrics.estimatedCostUsd > 0);
});

test('provider failures/refusals are sanitized and are not automatically retried', async (t) => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldEnabled = process.env.AI_ENABLED;
  const oldProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-placeholder-not-a-real-key'; process.env.AI_ENABLED = 'true';
  t.after(() => {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    if (oldEnabled === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = oldEnabled;
    if (oldProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = oldProvider;
  });
  for (const status of [401, 429, 500]) {
    await t.test(`HTTP ${status}`, async (t) => {
      let calls = 0;
      t.mock.method(globalThis, 'fetch', async () => {
        calls += 1;
        return Response.json({ error: { message: 'private-provider-details', type: 'error' } }, { status });
      });
      await assert.rejects(extractConversation(evaluationCases[1].request, new AbortController().signal), (error: unknown) => error instanceof ExtractionError && !error.message.includes('private-provider-details'));
      assert.equal(calls, 1);
    });
  }
  await t.test('refusal', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'mock', object: 'response', status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'private-provider-details' }] }] }));
    await assert.rejects(extractConversation(evaluationCases[1].request, new AbortController().signal), (error: unknown) => error instanceof ExtractionError && error.code === 'incomplete_output');
  });
});
