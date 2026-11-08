import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoPlaces, demoPlaceQuery, demoPlaceSummary, evaluatePlaces, placeQuerySchema, placeSearchSchema, unknownHours } from '@fuzl/planning';
import type { PlaceCandidate, PlaceQuery, PlaceSearch, PlaceResults } from '@fuzl/planning';
import { GeoapifyProvider } from './provider.js';
import { ExtractionError } from '../extraction/errors.js';
const now = '2026-11-07T12:00:00.000Z';
const fixture = () => demoPlaces(demoPlaceQuery, now);
const evaluate = (candidate?: PlaceCandidate, summary = demoPlaceSummary(), query: PlaceQuery = demoPlaceQuery) => { const f = fixture(); return evaluatePlaces(candidate ? [candidate] : f.candidates, f.area, query, summary); };
test('deterministic shortlist separates verified fit, unknown details and firm exclusion before ranking', () => {
  const result = evaluate();
  assert.deepEqual(result.verified.map(r => r.candidate.category), ['park']);
  assert.deepEqual(result.promising.map(r => r.candidate.category), ['bowling']);
  assert.equal(result.excluded[0].candidate.category, 'museum');
  assert.ok(result.excluded[0].checks.some(c => c.kind === 'budget' && c.status === 'does-not-fit'));
  const duplicate = fixture();
  assert.equal(evaluatePlaces([...duplicate.candidates, duplicate.candidates[0]], duplicate.area, demoPlaceQuery, demoPlaceSummary()).verified.length, 1);
  assert.equal(evaluate(undefined, demoPlaceSummary(), { ...demoPlaceQuery, date: null }).verified.length, 0);
  assert.equal(placeQuerySchema.safeParse({ ...demoPlaceQuery, area: 'Friday' }).success, false);
  assert.equal(placeQuerySchema.safeParse({ ...demoPlaceQuery, date: '2026-02-30' }).success, false);
  assert.equal(placeQuerySchema.safeParse({ ...demoPlaceQuery, timeZone: 'Invented/Zone' }).success, false);
});
test('zero is firm; unknown, different currencies, group prices and admission-only prices cannot establish affordability', () => {
  const walk = fixture().candidates[0], summary = demoPlaceSummary();
  assert.ok(summary.facts[0].kind === 'budget'); summary.facts[0].amount = 0;
  assert.equal(evaluate(walk, summary).verified.length, 1);
  assert.equal(evaluate({ ...walk, price: { ...walk.price, amount: 1 } }, summary).excluded.length, 1);
  summary.facts[0].amount = null;
  assert.equal(evaluate(walk, summary).verified.length, 0);
  summary.facts[0].amount = 20;
  for (const price of [{ ...walk.price, currency: null }, { ...walk.price, currency: 'EUR' }, { ...walk.price, basis: 'group' as const }, { ...walk.price, coverage: 'admission-only' as const }, { ...walk.price, amount: null }]) assert.equal(evaluate({ ...walk, price }, summary).verified.length, 0);
  summary.facts[0].strength = 'flexible';
  assert.equal(evaluate({ ...walk, price: { ...walk.price, amount: 40 } }, summary).excluded.length, 0);
});
test('private spending feasibility returns only general checks without amounts, aliases, currency or thresholds', () => {
  const f = fixture();
  const result = evaluatePlaces(f.candidates, f.area, demoPlaceQuery, demoPlaceSummary(), [{ state: 'known', amount: 0.17, currency: 'USD' }]);
  const checks = [...result.verified, ...result.promising, ...result.excluded].flatMap(r => r.checks.filter(c => c.kind === 'private-budget'));
  assert.ok(checks.some(c => c.status === 'does-not-fit'));
  assert.ok(!JSON.stringify(checks).includes('0.17') && !JSON.stringify(checks).includes('USD'));
  const unknown = evaluatePlaces([f.candidates[0]], f.area, demoPlaceQuery, demoPlaceSummary(), [{ state: 'unknown', amount: null, currency: null }]);
  assert.equal(unknown.verified.length, 0);
});
test('regular hours, ambiguous planning dates, unreviewed claims, missing travel time and free-text requirements stay unresolved', () => {
  const f = fixture(), summary = demoPlaceSummary();
  assert.equal(evaluate({ ...f.candidates[0], hours: { ...unknownHours, kind: 'regular', text: 'Every Saturday 9–20' } }).verified.length, 0);
  summary.facts.push({ id: 'maybe', kind: 'schedule', description: 'Maybe Friday', exactDate: null, startTime: null, endTime: null, subject: { kind: 'group' }, status: 'tentative', strength: 'flexible', sourceIds: [] });
  assert.equal(evaluate(undefined, summary).verified.length, 0);
  const firmWindow = demoPlaceSummary();
  firmWindow.facts.push({ id: 'firm-window', kind: 'schedule', description: null, exactDate: demoPlaceQuery.date, startTime: '14:00', endTime: '18:00', subject: { kind: 'group' }, status: 'confirmed', strength: 'firm', sourceIds: [] });
  assert.equal(evaluate(f.candidates[0], firmWindow).verified.length, 1, 'a chosen window inside firm availability fits');
  assert.equal(evaluate(f.candidates[0], firmWindow, { ...demoPlaceQuery, date: null }).excluded.length, 0, 'missing timing is unresolved rather than excluded');
  assert.equal(evaluate(f.candidates[0], firmWindow, { ...demoPlaceQuery, start: '13:00' }).excluded.length, 1);
  const ai = demoPlaceSummary(); ai.facts[0].extraction = { reviewed: false, reportedStatus: 'confirmed', scope: 'current', uncertainty: '', supersedes: [] };
  assert.equal(evaluate(undefined, ai).excluded.length, 0, 'unreviewed AI cannot exclude');
  assert.equal(evaluate(undefined, ai).verified.length, 0);
  ai.facts[0].extraction.scope = 'historical';
  assert.equal(evaluate(undefined, ai).excluded.length, 0);
  const travel = demoPlaceSummary(); travel.facts.push({ id: 'drive', kind: 'travel', maxMinutes: 10, mode: 'drive', comparison: 'at-most', subject: { kind: 'group' }, status: 'confirmed', strength: 'firm', sourceIds: [] });
  assert.ok(evaluate(undefined, travel).promising[0].checks.some(c => c.kind === 'travel' && c.status === 'needs-checking'));
  const other = demoPlaceSummary(); other.facts.push({ id: 'diet', kind: 'preference', description: 'Wheelchair access and vegan food', subject: { kind: 'group' }, status: 'confirmed', strength: 'firm', sourceIds: [] });
  assert.equal(evaluate(undefined, other).verified.length, 0);
  other.facts.push({ id: 'unattributed', kind: 'activity', description: 'museum', subject: { kind: 'unknown' }, status: 'confirmed', strength: 'firm', sourceIds: [] });
  const unattributed = evaluate(f.candidates[0], other);
  assert.equal(unattributed.excluded.length, 0, 'unknown attribution cannot invent a group requirement');
  assert.equal(unattributed.verified.length, 0);
});
test('Geoapify adapter uses the chosen outside-Columbus area and only location/filter inputs; unknown prices/hours remain unknown', async () => {
  const urls: URL[] = [];
  const request = (async (input: Parameters<typeof fetch>[0]) => { const url = new URL(String(input)); urls.push(url); return urls.length === 1 ? Response.json({ results: [{ country_code: 'us', result_type: 'city', city: 'Cleveland', state: 'Ohio', state_code: 'OH', formatted: 'Cleveland, OH', lat: 41.5, lon: -81.7 }] }) : Response.json({ features: [{ properties: { place_id: 'stable-id', name: 'Synthetic provider park', lat: 41.5, lon: -81.7, categories: ['leisure.park'] } }] }); }) as typeof fetch;
  const result = await new GeoapifyProvider('synthetic-key', request).search({ area: 'Cleveland, OH', category: 'park', radiusKm: 4 }, new AbortController().signal);
  assert.equal(urls[0].searchParams.get('city'), 'Cleveland');
  assert.equal(urls[0].searchParams.has('text'), false);
  assert.deepEqual([...urls[1].searchParams.keys()].sort(), ['apiKey', 'bias', 'categories', 'filter', 'limit']);
  assert.equal(urls[1].searchParams.get('filter'), 'circle:-81.7,41.5,4000');
  assert.equal(result.candidates[0].price.amount, null); assert.equal(result.candidates[0].hours.kind, 'unknown');
  assert.ok(!JSON.stringify(result).includes('synthetic-key'));
  assert.equal(demoPlaces({ ...demoPlaceQuery, area: '44114' }, now).area.label, 'Demo Cleveland area');
});
test('provider handles missing/malformed results, ambiguous matches, HTTP quota/access, network and deadlines without leaking errors or retrying', async () => {
  const query = { area: '43210', category: 'park' as const, radiusKm: 5 };
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    const provider = new GeoapifyProvider('secret', (async () => { calls++; return new Response('raw-private-upstream-message', { status }); }) as typeof fetch);
    await assert.rejects(provider.search(query, new AbortController().signal), e => e instanceof ExtractionError && e.message.includes(String(status)) && !e.message.includes('raw-private'));
    assert.equal(calls, 1);
  }
  await assert.rejects(new GeoapifyProvider('secret', (async () => { throw new Error('https://provider/?apiKey=secret'); }) as typeof fetch).search(query, new AbortController().signal), e => e instanceof ExtractionError && e.code === 'places_network' && !e.message.includes('secret'));
  const aborted = AbortSignal.abort();
  await assert.rejects(new GeoapifyProvider('secret', (async () => { throw Error('secret'); }) as typeof fetch).search(query, aborted), e => e instanceof ExtractionError && e.code === 'places_timeout');
  for (const response of [new Response('{broken'), Response.json({ results: [] }), Response.json({ results: [{ country_code: 'us', result_type: 'postcode', formatted: 'ZIP', lat: 40, lon: -83, postcode: '43211' }] }), Response.json({ results: [{ country_code: 'us', result_type: 'postcode', formatted: 'ZIP', lat: 40, lon: -83 }, { country_code: 'us', result_type: 'postcode', formatted: 'ZIP', lat: 40, lon: -83 }] })]) {
    await assert.rejects(new GeoapifyProvider('secret', (async () => response) as typeof fetch).search(query, new AbortController().signal), e => e instanceof ExtractionError && !e.message.includes('secret'));
  }
});
test('authenticated search enforces ownership/context, explicit live setup, provider allowlist and stale private context without fallback or logs', async t => {
  const { createApp } = await import('../app.js');
  const savedId = '11111111-1111-4111-8111-111111111111';
  const payload: PlaceSearch = placeSearchSchema.parse({ mode: 'demo', query: demoPlaceQuery, summary: demoPlaceSummary(), sessionRevision: 1, manual: [] });
  let version = 1, calls = 0, contextReads = 0;
  const store = { context: async (subject: string, id: string) => { contextReads++; if (subject !== 'owner' || id !== savedId) throw new ExtractionError(404, 'not_found', 'Unavailable'); return { privateSpending: [{ amount: 0.17, currency: 'USD', state: 'known' }], version: String(version) }; } };
  let logs = 0; t.mock.method(console, 'error', () => { logs++; });
  const before = { enabled: process.env.VENUE_SEARCH_ENABLED, key: process.env.GEOAPIFY_API_KEY };
  delete process.env.VENUE_SEARCH_ENABLED; delete process.env.GEOAPIFY_API_KEY;
  t.after(() => { for (const [key, value] of Object.entries({ VENUE_SEARCH_ENABLED: before.enabled, GEOAPIFY_API_KEY: before.key })) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  const make = async (provider?: import('./provider.js').VenueProvider) => {
    const server = createApp({ accounts: { verify: async token => token === 'owner-synthetic-token' ? 'owner' : 'other', places: { store: () => store, provider } } }).listen(0, '127.0.0.1');
    await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
    return (data: PlaceSearch, token = 'owner-synthetic-token', id = savedId) => fetch(`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/private/sessions/${id}/places/search`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  };
  const call = await make();
  assert.equal((await call(payload, 'other-synthetic-token')).status, 404);
  const demo = await call(payload); assert.equal(demo.status, 200);
  const dto = await demo.json() as PlaceResults;
  assert.ok(!JSON.stringify(dto).includes('0.17'));
  assert.equal(dto.mode, 'demo'); assert.ok(demo.headers.get('cache-control')?.includes('no-store'));
  assert.equal((await call({ ...payload, mode: 'live' })).status, 503);
  const live = await make({ search: async query => { calls++; assert.deepEqual(Object.keys(query).sort(), ['area', 'category', 'radiusKm']); version++; return fixture(); } });
  assert.equal((await live({ ...payload, mode: 'live' })).status, 409);
  assert.equal(calls, 1); assert.ok(contextReads >= 5); assert.equal(logs, 0);
  let release: (() => void) | undefined;
  const bounded = await make({ search: async () => { await new Promise<void>(resolve => { release = resolve; }); return fixture(); } });
  const first = bounded({ ...payload, mode: 'live' });
  for (let i = 0; i < 100 && !release; i++) await new Promise(r => setTimeout(r, 5));
  assert.ok(release);
  assert.equal((await bounded({ ...payload, mode: 'live' })).status, 429, 'only one live search can run at once');
  release(); assert.equal((await first).status, 200);
});
