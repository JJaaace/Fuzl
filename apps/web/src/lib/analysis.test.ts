import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GEMINI_MODEL, MODEL } from '@fuzl/planning';
import { analyzeConversation, fetchAIConfiguration, sameAnalysisSource } from './analysis';

test('analysis source checks prevent old drafts/reference dates being applied', () => {
  const submitted = { conversation: 'Sam: Maybe Friday', referenceDate: null };
  assert.equal(sameAnalysisSource(submitted, submitted.conversation, null), true);
  assert.equal(sameAnalysisSource(submitted, 'New draft', null), false);
  assert.equal(sameAnalysisSource(submitted, submitted.conversation, '2026-11-06'), false);
  assert.equal(sameAnalysisSource({ ...submitted, expectedProvider: 'gemini' }, submitted.conversation, null, 'openai'), false);
});

test('configuration is public allowlisted metadata, and invalid/error responses do not enable analysis', async (t) => {
  await t.test('selected Gemini', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url: string) => {
      assert.equal(url, '/api/ai-config');
      return Response.json({ provider: 'gemini', model: GEMINI_MODEL });
    });
    assert.deepEqual(await fetchAIConfiguration(new AbortController().signal), { provider: 'gemini', model: GEMINI_MODEL });
  });
  await t.test('unexpected fields are rejected', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ provider: 'gemini', model: GEMINI_MODEL, apiKey: 'test-placeholder' }));
    await assert.rejects(fetchAIConfiguration(new AbortController().signal), /invalid provider configuration/);
  });
  await t.test('server unavailable', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 503 }));
    await assert.rejects(fetchAIConfiguration(new AbortController().signal), /Could not read the selected provider/);
  });
});

test('client accepts Gemini metadata with unknown cost, but rejects an unexpected response provider', async (t) => {
  const result = { summary: { participants: [], speakers: [], sources: [], facts: [], questions: [] }, warnings: [],
    metrics: { provider: 'gemini', model: GEMINI_MODEL, latencyMs: 10, inputTokens: 100, outputTokens: 20, estimatedCostUsd: null } };
  t.mock.method(globalThis, 'fetch', async () => Response.json(result));
  const request = { conversation: 'Sam: Maybe Friday', referenceDate: null, expectedProvider: 'gemini' as const };
  assert.equal((await analyzeConversation(request, new AbortController().signal)).metrics.estimatedCostUsd, null);
  await assert.rejects(analyzeConversation({ ...request, expectedProvider: 'openai' }, new AbortController().signal), /response provider does not match/);
});

test('analysis client explicitly posts the bounded draft, validates response, and preserves cancellation', async (t) => {
  const request = { conversation: 'Sam: Maybe Friday', referenceDate: null };
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/analyze'); assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(String(options.body)), request); assert.ok(options.signal);
    return Response.json({ summary: { participants: [], speakers: [], sources: [], facts: [], questions: [] }, warnings: [], metrics: { provider: 'openai', model: MODEL, latencyMs: 10, inputTokens: null, outputTokens: null, estimatedCostUsd: null } });
  });
  assert.equal((await analyzeConversation(request, new AbortController().signal)).metrics.latencyMs, 10);
  await assert.rejects(analyzeConversation({ ...request, conversation: '' }, new AbortController().signal), /1–6000/);
});

test('analysis client reports missing configuration, invalid output, cancellation, and never returns samples', async (t) => {
  const request = { conversation: 'Sam: Maybe Friday', referenceDate: null };
  await t.test('server error', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'AI is not configured' } }, { status: 503 }));
    await assert.rejects(analyzeConversation(request, new AbortController().signal), /not configured/);
  });
  await t.test('invalid output', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ summary: 'fake' }));
    await assert.rejects(analyzeConversation(request, new AbortController().signal), /invalid summary/);
  });
  await t.test('abort', async (t) => {
    t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(options.signal!.reason), { once: true });
    }));
    const controller = new AbortController();
    const promise = analyzeConversation(request, controller.signal); controller.abort();
    await assert.rejects(promise, { name: 'AbortError' });
  });
});
