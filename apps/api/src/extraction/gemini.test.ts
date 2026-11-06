import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import { GEMINI_MODEL, MODEL, analysisResponseSchema, blankFact } from '@fuzl/planning';
import type { ProviderOutput } from '@fuzl/planning';
import { evaluationCases } from './cases.js';
import { getAIConfiguration, ensureAIConfigured } from './configuration.js';
import { extractConversation } from './provider.js';
import { convertGeminiOutput, geminiResponseSchema } from './gemini-schema.js';
import { validateExtraction } from './validate.js';
import { ExtractionError } from './errors.js';
import { createApp } from '../app.js';

function environment(t: TestContext, values: Record<string, string | undefined> = {}) {
  for (const key of ['AI_PROVIDER', 'AI_ENABLED', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) {
    const previous = process.env[key];
    const value = { AI_PROVIDER: 'gemini', AI_ENABLED: 'true', GEMINI_API_KEY: 'test-only-gemini-placeholder', ...values }[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

function wireOutput(output: ProviderOutput) {
  return { ...structuredClone(output), facts: output.facts.map((item) => {
    const fact = item.fact;
    return { ...item, fact: {
      id: fact.id, kind: fact.kind, status: fact.status, strength: fact.strength, sourceIds: fact.sourceIds,
      subjectKind: fact.subject.kind,
      subjectId: fact.subject.kind === 'speaker' ? fact.subject.speakerId : fact.subject.kind === 'participant' ? fact.subject.participantId : null,
      description: 'description' in fact ? fact.description : null,
      exactDate: fact.kind === 'schedule' ? fact.exactDate : null,
      startTime: fact.kind === 'schedule' ? fact.startTime : null, endTime: fact.kind === 'schedule' ? fact.endTime : null,
      amount: fact.kind === 'budget' ? fact.amount : null, currency: fact.kind === 'budget' ? fact.currency : null,
      maxMinutes: fact.kind === 'travel' ? fact.maxMinutes : null, mode: fact.kind === 'travel' ? fact.mode : null,
      comparison: fact.kind === 'travel' ? fact.comparison : 'unknown',
    } };
  }) };
}
function envelope(output: unknown = wireOutput(evaluationCases[1].authoredOutput)) {
  return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 7 } };
}

test('provider selection requires only selected credentials and never falls back for invalid configuration', async (t) => {
  await t.test('Gemini needs no OpenAI key', (t) => {
    environment(t);
    assert.deepEqual(getAIConfiguration(), { provider: 'gemini', model: GEMINI_MODEL });
    assert.equal(ensureAIConfigured().apiKey, 'test-only-gemini-placeholder');
  });
  await t.test('OpenAI default preserves old configuration and needs no Gemini key', (t) => {
    environment(t, { AI_PROVIDER: undefined, GEMINI_API_KEY: undefined, OPENAI_API_KEY: 'test-only-openai-placeholder' });
    assert.deepEqual(getAIConfiguration(), { provider: 'openai', model: MODEL });
    assert.equal(ensureAIConfigured().apiKey, 'test-only-openai-placeholder');
  });
  await t.test('missing selected key does not use another available key', (t) => {
    environment(t, { GEMINI_API_KEY: undefined, OPENAI_API_KEY: 'test-only-openai-placeholder' });
    assert.throws(ensureAIConfigured, /Set GEMINI_API_KEY/);
    process.env.AI_PROVIDER = 'openai'; delete process.env.OPENAI_API_KEY; process.env.GEMINI_API_KEY = 'test-only-gemini-placeholder';
    assert.throws(ensureAIConfigured, /Set OPENAI_API_KEY/);
  });
  await t.test('invalid/empty setting and disabled AI fail closed', (t) => {
    environment(t, { AI_PROVIDER: 'other', OPENAI_API_KEY: 'test-only-openai-placeholder' });
    assert.throws(ensureAIConfigured, /AI_PROVIDER/);
    process.env.AI_PROVIDER = ''; assert.throws(ensureAIConfigured, /AI_PROVIDER/);
    process.env.AI_PROVIDER = 'gemini'; process.env.AI_ENABLED = 'false'; assert.throws(ensureAIConfigured, /AI_ENABLED/);
  });
});

test('flat Gemini wire output round-trips without changing the canonical summary/evidence checks', () => {
  for (const item of evaluationCases) {
    const converted = convertGeminiOutput(wireOutput(item.authoredOutput));
    assert.deepEqual(converted, item.authoredOutput);
    assert.ok(item.check(validateExtraction(converted, item.request).summary), item.id);
  }
  for (const kind of ['schedule', 'budget', 'activity', 'travel', 'preference'] as const) {
    const output = structuredClone(evaluationCases[1].authoredOutput);
    output.facts[0].fact = { ...blankFact(kind, 'manual'), sourceIds: ['q0'] };
    assert.deepEqual(convertGeminiOutput(wireOutput(output)), output);
  }
  const schema = JSON.stringify(geminiResponseSchema);
  assert.ok(schema.includes('subjectKind'));
  assert.ok(!schema.includes('$schema') && !schema.includes('maxItems') && !schema.includes('pattern'));
});

test('Gemini wire parsing does not weaken canonical validation or discard hidden fields', () => {
  const candidate = wireOutput(evaluationCases[1].authoredOutput);
  candidate.facts[0].fact.description = 'Irrelevant hidden content';
  assert.throws(() => convertGeminiOutput(candidate), ExtractionError);
  candidate.facts[0].fact.description = null;
  candidate.facts[0].fact.amount = -1;
  assert.throws(() => convertGeminiOutput(candidate), ExtractionError);
  const hallucinated = wireOutput(evaluationCases[1].authoredOutput);
  hallucinated.sources[0].text = 'Invented source';
  assert.throws(() => validateExtraction(convertGeminiOutput(hallucinated), evaluationCases[1].request), ExtractionError);
});

test('Gemini request uses only Google, a private header, bounded JSON output, and the original prompt rules', async (t) => {
  environment(t, { OPENAI_API_KEY: 'test-only-other-provider-placeholder' });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    calls += 1;
    assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`);
    assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    assert.equal((options.headers as Record<string, string>)['x-goog-api-key'], 'test-only-gemini-placeholder');
    const body = JSON.parse(String(options.body));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseJsonSchema, geminiResponseSchema);
    assert.equal(body.generationConfig.maxOutputTokens, 6000); assert.equal(body.generationConfig.candidateCount, 1);
    assert.equal(body.tools, undefined);
    assert.ok(body.systemInstruction.parts[0].text.includes('UNTRUSTED'));
    assert.ok(!String(options.body).includes('test-only-gemini-placeholder'));
    return Response.json(envelope());
  });
  const result = await extractConversation({ ...evaluationCases[1].request, expectedProvider: 'gemini' }, new AbortController().signal);
  assert.equal(calls, 1); assert.equal(result.metrics.provider, 'gemini'); assert.equal(result.metrics.model, GEMINI_MODEL);
  assert.equal(result.metrics.outputTokens, 57); assert.equal(result.metrics.estimatedCostUsd, null);
  assert.equal(result.summary.facts[0].extraction?.reviewed, false);
  assert.ok(analysisResponseSchema.safeParse(result).success);
  assert.equal(analysisResponseSchema.safeParse({ ...result, metrics: { ...result.metrics, model: MODEL } }).success, false);
});

test('Gemini quota/access/schema failures make one call only, sanitize details, and never fall back', async (t) => {
  environment(t, { OPENAI_API_KEY: 'test-only-other-provider-placeholder' });
  for (const [status, expected] of [[429, 'provider_limit'], [401, 'provider_access'], [403, 'provider_access'], [404, 'model_unavailable'], [400, 'provider_request'], [500, 'provider_failure']] as const) {
    await t.test(`HTTP ${status}`, async (t) => {
      let calls = 0;
      t.mock.method(globalThis, 'fetch', async (url: string) => {
        calls += 1; assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));
        return Response.json({ error: { message: 'private-provider-detail' } }, { status });
      });
      await assert.rejects(extractConversation(evaluationCases[1].request, new AbortController().signal), (error: unknown) => {
        assert.ok(error instanceof ExtractionError); assert.equal(error.code, expected);
        assert.ok(!error.message.includes('private-provider-detail'));
        if (status === 429) assert.match(error.message, /Free Tier.*No other provider/);
        return true;
      });
      assert.equal(calls, 1);
    });
  }
});

test('malformed, incomplete, blocked, unsupported, and hallucinated Gemini output is rejected', async (t) => {
  environment(t);
  const wrongQuote = wireOutput(evaluationCases[1].authoredOutput); wrongQuote.sources[0].text = 'Invented quote';
  for (const output of [
    { candidates: [] }, { promptFeedback: { blockReason: 'SAFETY' } },
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] },
    envelope({ nonsense: true }), envelope(wrongQuote),
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ functionCall: { name: 'anything' } }] } }] },
  ]) {
    await t.test('invalid candidate', async (t) => {
      t.mock.method(globalThis, 'fetch', async () => Response.json(output));
      await assert.rejects(extractConversation(evaluationCases[1].request, new AbortController().signal), ExtractionError);
    });
  }
});

test('Gemini cancellation propagates, and a provider change prevents any request', async (t) => {
  environment(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => {
    calls += 1;
    return new Promise((_resolve, reject) => options.signal!.addEventListener('abort', () => reject(options.signal!.reason), { once: true }));
  });
  await assert.rejects(extractConversation({ ...evaluationCases[1].request, expectedProvider: 'openai' }, new AbortController().signal), /provider changed/);
  assert.equal(calls, 0);
  const controller = new AbortController();
  const request = extractConversation(evaluationCases[1].request, controller.signal);
  controller.abort();
  await assert.rejects(request, (error: unknown) => error instanceof ExtractionError && error.status === 504);
  assert.equal(calls, 1);
});

test('public provider configuration exposes no credentials and rejects mismatched consent before extraction', async (t) => {
  environment(t);
  let calls = 0;
  const app = createApp({ extract: async () => { calls += 1; throw new Error('should not run'); } });
  const listener = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => listener.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => listener.close(() => resolve())));
  const origin = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
  const result = await fetch(`${origin}/api/ai-config`);
  assert.deepEqual(await result.json(), { provider: 'gemini', model: GEMINI_MODEL });
  const mismatch = await fetch(`${origin}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...evaluationCases[1].request, expectedProvider: 'openai' }) });
  assert.equal(mismatch.status, 409); assert.equal(calls, 0);
});
