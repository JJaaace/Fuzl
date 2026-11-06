import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkHealth } from './api';

test('health checks validate responses, send no draft, and terminate failed requests', async (t) => {
  await t.test('valid health response uses only a relative GET', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
      assert.equal(url, '/api/health');
      assert.equal(options.body, undefined);
      assert.equal(options.method, undefined); // fetch defaults to GET
      assert.equal(options.cache, 'no-store');
      return Response.json({ status: 'ok', service: 'fuzl-api' });
    });
    await checkHealth(new AbortController().signal);
  });

  for (const [name, response, expected] of [
    ['HTTP failure', () => new Response('', { status: 503 }), /HTTP 503/],
    ['invalid JSON', () => new Response('not JSON'), /invalid JSON/],
    ['wrong service', () => Response.json({ status: 'ok', service: 'other' }), /Unexpected API response/],
    ['null body', () => Response.json(null), /Unexpected API response/],
    ['wrong status', () => Response.json({ status: 'down', service: 'fuzl-api' }), /Unexpected API response/],
  ] as const) {
    await t.test(name, async (t) => {
      t.mock.method(globalThis, 'fetch', async () => response());
      await assert.rejects(checkHealth(new AbortController().signal), expected);
    });
  }

  await t.test('network failure is reported', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(checkHealth(new AbortController().signal), TypeError);
  });

  await t.test('an unresponsive request times out within six seconds', async (t) => {
    t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      const keepAlive = setTimeout(() => reject(new Error('Request did not time out')), 6000);
      options.signal?.addEventListener('abort', () => {
        clearTimeout(keepAlive);
        reject(options.signal?.reason);
      }, { once: true });
    }));
    await assert.rejects(checkHealth(new AbortController().signal), { name: 'TimeoutError' });
  });

  await t.test('a superseded request can be cancelled', async (t) => {
    t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
    }));
    const controller = new AbortController();
    const result = checkHealth(controller.signal);
    controller.abort();
    await assert.rejects(result, { name: 'AbortError' });
  });
});
