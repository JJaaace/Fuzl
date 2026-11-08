import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoEvents, demoPlaceSummary, emptySummary, areaSchema, placeResultsSchema, evaluatePlaces, demoPlaceQuery, evaluateEvents, eventQuerySchema, eventResponseSchema, eventResultsSchema, eventSearchSchema } from '@fuzl/planning';
import type { EventQuery, EventSearch, PlanningSummary, ScheduledEvent } from '@fuzl/planning';
import { TicketmasterProvider, geoHash } from './provider.js';
import type { EventProvider, EventProviderQuery, AreaResolver } from './provider.js';
import { GeoapifyProvider } from '../places/provider.js';
import { ExtractionError } from '../extraction/errors.js';
const stamp = '2026-11-07T12:00:00.000Z';
const query: EventQuery = { area: '02108', radiusKm: 5, from: '2026-11-14', to: '2026-11-14' };
const fixture = () => { const f = demoEvents(query, stamp); assert.ok('area' in f); return f; };
function evaluate(event?: ScheduledEvent, summary: PlanningSummary = demoPlaceSummary(), q = query) { const f = fixture(); return evaluateEvents(event ? [event] : f.events, f.area, q, summary); }
test('event fixture selects up to three useful Boston events, excludes cancelled/out-of-range, preserves postponement and starting-price uncertainty', () => {
  const f = fixture(), r = evaluate();
  assert.ok(f.area.label.includes('Boston')); assert.equal(r.verified[0].event.id, 'fitting');
  assert.equal(r.verified.length + r.promising.length, 3);
  assert.ok(r.excluded.some(e => e.event.id === 'outside')); assert.ok(r.excluded.some(e => e.event.id === 'cancelled'));
  assert.equal(evaluate({ ...f.events[0], providerStatus: 'canceled' }).excluded.length, 1, 'official API spelling');
  for (const code of ['postponed', 'rescheduled', null, 'new-status']) assert.equal(evaluate({ ...f.events[0], providerStatus: code }).verified.length, 0);
  const starting = evaluate(f.events[1]); assert.equal(starting.verified.length, 0); assert.equal(starting.promising[0].event.price.kind, 'starting');
  assert.ok(starting.promising[0].checks.some(c => c.kind === 'budget' && c.status === 'needs-checking'));
  assert.ok(eventResultsSchema.safeParse({ ...r, mode: 'demo', area: f.area, query, retrievedAt: stamp }).success);
});
test('explicit inclusive local date boundaries, leading-zero ZIP and bounded range validation', () => {
  for (const patch of [{ from: '', to: '' }, { from: '2026-02-30' }, { to: '2026-11-13' }, { to: '2026-12-15' }, { area: '2108' }, { radiusKm: 31 }]) assert.equal(eventQuerySchema.safeParse({ ...query, ...patch }).success, false);
  assert.equal(eventQuerySchema.parse(query).area, '02108');
  const e = fixture().events[0];
  for (const date of ['2026-11-14', '2026-11-15']) assert.equal(evaluate({ ...e, schedule: { ...e.schedule, date, endDate: date } }, demoPlaceSummary(), { ...query, to: '2026-11-15' }).verified.length, 1);
  for (const date of ['2026-11-13', '2026-11-16']) assert.equal(evaluate({ ...e, schedule: { ...e.schedule, date, endDate: date } }, demoPlaceSummary(), { ...query, to: '2026-11-15' }).excluded.length, 1);
  const late = { ...e, schedule: { ...e.schedule, time: '23:30', endDate: '2026-11-15', endTime: '00:30', utcStart: '2026-11-15T04:30:00.000Z' } };
  assert.equal(evaluate(late).verified.length, 1, 'use local date, not the next UTC day');
  assert.equal(evaluate({ ...late, schedule: { ...late.schedule, utcStart: '2026-11-15T05:30:00.000Z' } }).verified.length, 0, 'conflicting UTC and local clocks');
});
test('date-only, missing zones, DST folds and zone disagreements stay unresolved', () => {
  const e = fixture().events[0];
  for (const patch of [{ time: null }, { timeZone: null }, { zoneConflict: true }, { timeUncertain: true }, { dateUncertain: true }, { date: '2026-11-01', time: '01:30' }]) assert.equal(evaluate({ ...e, schedule: { ...e.schedule, ...patch } }, demoPlaceSummary(), { ...query, from: '2026-11-01' }).verified.length, 0);
});
test('search dates do not rewrite tentative facts; firm schedule, unknown budgets, unreviewed and private budgets remain conservative', () => {
  const f = fixture(), summary = demoPlaceSummary(), before = structuredClone(summary);
  summary.facts.push({ id: 'maybe', subject: { kind: 'group' }, sourceIds: [], kind: 'schedule', description: 'Maybe Friday', exactDate: null, startTime: null, endTime: null, status: 'tentative', strength: 'flexible' });
  const original = structuredClone(summary); assert.equal(evaluate(f.events[0], summary).verified.length, 0); assert.deepEqual(summary, original);
  assert.deepEqual(demoPlaceSummary(), before);
  const firm = demoPlaceSummary(); firm.facts.push({ id: 'schedule', subject: { kind: 'group' }, sourceIds: [], kind: 'schedule', description: null, exactDate: '2026-11-14', startTime: '15:00', endTime: '17:00', status: 'confirmed', strength: 'firm' });
  assert.equal(evaluate(f.events[0], firm).verified.length, 1);
  const incomplete = structuredClone(firm); assert.ok(incomplete.facts[2].kind === 'schedule'); incomplete.facts[2].startTime = null; incomplete.facts[2].endTime = null; assert.equal(evaluate(f.events[0], incomplete).verified.length, 0, 'unknown clock bounds are not all-day availability');
  assert.equal(evaluate({ ...f.events[0], schedule: { ...f.events[0].schedule, endTime: null } }, firm).verified.length, 0);
  assert.equal(evaluate({ ...f.events[0], schedule: { ...f.events[0].schedule, time: '14:00' } }, firm).excluded.length, 1);
  const unknown = demoPlaceSummary(); assert.ok(unknown.facts[0].kind === 'budget'); unknown.facts[0].amount = null;
  assert.equal(evaluate(f.events[0], unknown).verified.length, 0);
  unknown.facts[0].amount = 0; assert.equal(evaluate(f.events[0], unknown).excluded.length, 1);
  unknown.facts[0].extraction = { reviewed: false, reportedStatus: 'confirmed', uncertainty: '', scope: 'current', supersedes: [] };
  assert.equal(evaluate(f.events[0], unknown).excluded.length, 0);
  assert.equal(evaluate(f.events[0], emptySummary()).verified.length, 0);
  const privateResult = evaluateEvents(f.events, f.area, query, demoPlaceSummary(), [{ amount: 7.31, currency: 'USD', state: 'known' }]);
  assert.ok(privateResult.excluded.some(e => e.checks.some(c => c.kind === 'private-budget' && c.status === 'does-not-fit')));
  assert.ok(!JSON.stringify(privateResult).includes('7.31'));
  const checks = [...privateResult.excluded, ...privateResult.promising].flatMap(e => e.checks.filter(c => c.kind === 'private-budget'));
  assert.ok(!JSON.stringify(checks).includes('USD')); assert.ok(!JSON.stringify(checks).includes('amount'));
});
const upstreamEvent = () => ({ id: 'synthetic-event', name: 'Synthetic Boston event', url: 'https://www.ticketmaster.com/event/synthetic', dates: { start: { localDate: '2026-11-14', localTime: '15:00:00', dateTime: '2026-11-14T20:00:00Z', dateTBD: false }, timezone: 'America/New_York', status: { code: 'onsale' } }, priceRanges: [{ min: 8, max: 40, currency: 'USD' }], _embedded: { venues: [{ name: 'Synthetic hall', address: { line1: 'Synthetic address' }, city: { name: 'Boston' }, state: { stateCode: 'MA' }, location: { latitude: '42.357', longitude: '-71.063' }, timezone: 'America/New_York' }] } });
const envelope = (events: unknown[]) => ({ page: { totalElements: events.length }, _embedded: { events } });
const providerQuery: EventProviderQuery = { lat: 42.357, lon: -71.063, from: query.from, to: query.to, radiusKm: 5 };
test('Ticketmaster adapter sends documented geohash/local range, maps unknowns and starting prices without claiming inventory', async () => {
  let calls = 0;
  const provider = new TicketmasterProvider('synthetic-key', (async input => {
    calls++; const url = new URL(String(input));
    assert.equal(url.origin + url.pathname, 'https://app.ticketmaster.com/discovery/v2/events.json');
    assert.equal(url.searchParams.get('geoPoint'), geoHash(providerQuery.lat, providerQuery.lon));
    assert.equal(url.searchParams.get('localStartDateTime'), '2026-11-14T00:00:00,2026-11-14T23:59:59');
    assert.deepEqual([...url.searchParams.keys()].sort(), ['apikey', 'countryCode', 'geoPoint', 'includeTBA', 'includeTBD', 'localStartDateTime', 'page', 'radius', 'size', 'sort', 'unit'].sort());
    return Response.json(envelope([upstreamEvent(), { id: 'minimal', name: 'Date only', url: 'https://www.ticketmaster.com/event/minimal', dates: { start: { localDate: '2026-11-14', timeTBA: true } } }]));
  }) as typeof fetch, () => Date.parse(stamp));
  const events = await provider.search(providerQuery, new AbortController().signal);
  assert.equal(calls, 1); assert.equal(geoHash(42.6, -5.6), 'ezs42e44y');
  assert.equal(events[0].price.kind, 'starting'); assert.equal(events[0].price.fees, 'unknown');
  assert.equal(events[0].providerStatus, 'onsale'); assert.equal(events[1].venue.name, null); assert.equal(events[1].schedule.time, null); assert.equal(events[1].price.amount, null);
  assert.ok(!JSON.stringify(events).includes('synthetic-key'));
});
test('provider quota/access/http/network/timeout/malformed responses never leak keys, raw bodies or perform retries', async () => {
  for (const status of [401, 403, 429, 500]) {
    let calls = 0; const p = new TicketmasterProvider('secret', (async () => { calls++; return new Response('private-upstream-key=secret', { status }); }) as typeof fetch);
    await assert.rejects(p.search(providerQuery, new AbortController().signal), e => e instanceof ExtractionError && e.message.includes(String(status)) && !e.message.includes('secret'));
    assert.equal(calls, 1);
  }
  for (const signal of [new AbortController().signal, AbortSignal.abort()]) await assert.rejects(new TicketmasterProvider('secret', (async () => { throw Error('https://provider/?apikey=secret'); }) as typeof fetch).search(providerQuery, signal), e => e instanceof ExtractionError && e.code === (signal.aborted ? 'events_timeout' : 'events_network') && !e.message.includes('secret'));
  const e = upstreamEvent();
  for (const data of [{}, { fault: { text: 'secret' } }, envelope([{ ...e, url: 'https://example.com/api?apikey=secret' }]), envelope([{ ...e, dates: { start: { localDate: '2026-02-30' } } }]), envelope([{ ...e, dates: { start: { localTime: '15:00hacked' } } }]), envelope([{ ...e, url: 'https://www.ticketmaster.com/event/id?token=secret' }])]) {
    await assert.rejects(new TicketmasterProvider('secret', (async () => Response.json(data)) as typeof fetch).search(providerQuery, new AbortController().signal), err => err instanceof ExtractionError && err.code === 'events_invalid_response' && !err.message.includes('secret'));
  }
  const empty = await new TicketmasterProvider('secret', (async () => Response.json({ page: { totalElements: 0 } })) as typeof fetch).search(providerQuery, new AbortController().signal); assert.deepEqual(empty, []);
});

test('owned event route enforces auth, selected credentials, minimal provider inputs, redaction, stale context and deliberate bounds', async t => {
  const { createApp } = await import('../app.js');
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const payload: EventSearch = eventSearchSchema.parse({ mode: 'demo', query, summary: demoPlaceSummary(), sessionRevision: 1 });
  let version = 1, reads = 0, eventCalls = 0, resolveCalls = 0, clock = Date.parse(stamp);
  const f = fixture();
  const context = async (subject: string, id: string, request: Pick<EventSearch, 'sessionRevision'>) => { reads++; if (subject !== 'owner' || id !== sessionId) throw new ExtractionError(404, 'not_found', 'Unavailable'); if (request.sessionRevision !== 1) throw new ExtractionError(409, 'stale', 'Reopen current session'); return { privateSpending: [{ amount: 7.31, currency: 'USD', state: 'known' }], version: String(version) }; };
  const resolver: AreaResolver = { resolve: async q => { resolveCalls++; assert.deepEqual(Object.keys(q), ['area']); assert.equal(q.area, '02108'); return { area: f.area }; } };
  const provider: EventProvider = { search: async q => { eventCalls++; assert.deepEqual(Object.keys(q).sort(), ['lat', 'lon', 'radiusKm', 'from', 'to'].sort()); return f.events; } };
  const savedEnabled = process.env.EVENT_SEARCH_ENABLED, savedKey = process.env.TICKETMASTER_API_KEY; delete process.env.EVENT_SEARCH_ENABLED; delete process.env.TICKETMASTER_API_KEY;
  t.after(() => { if (savedEnabled === undefined) delete process.env.EVENT_SEARCH_ENABLED; else process.env.EVENT_SEARCH_ENABLED = savedEnabled; if (savedKey === undefined) delete process.env.TICKETMASTER_API_KEY; else process.env.TICKETMASTER_API_KEY = savedKey; });
  let logs = 0; t.mock.method(console, 'error', () => { logs++; });
  async function make(eventProvider?: EventProvider, areaResolver?: AreaResolver) {
    const server = createApp({ accounts: { verify: async token => token === 'owner-synthetic-token' ? 'owner' : 'other', events: { store: () => ({ context }), resolver: areaResolver, provider: eventProvider, now: () => clock } } }).listen(0, '127.0.0.1');
    await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
    return (body: unknown = payload, token = 'owner-synthetic-token') => fetch(`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/private/sessions/${sessionId}/events/search`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  const offline = await make(); assert.equal((await offline()).status, 200); assert.equal(resolveCalls, 0);
  const denied = await offline(payload, 'other-synthetic-token'); assert.equal(denied.status, 404);
  assert.equal((await offline(payload, '')).status, 401);
  assert.equal((await offline({ ...payload, sessionRevision: 2 })).status, 409);
  assert.equal((await offline({ ...payload, query: { ...query, from: '' } })).status, 400);
  assert.equal((await offline({ ...payload, mode: 'live' })).status, 503); assert.equal(eventCalls, 0);
  const live = await make(provider, resolver);
  const ok = await live({ ...payload, mode: 'live' }); assert.equal(ok.status, 200); assert.equal(ok.headers.get('cache-control'), 'no-store, private'); const text = await ok.text(); assert.ok(!text.includes('7.31')); assert.ok(!text.includes('privateSpending')); assert.ok(!text.includes('version')); assert.equal(eventCalls, 1);
  const clarified = await make(provider, { resolve: async () => { const r = demoEvents({ ...query, area: 'Springfield' }, stamp); assert.ok('choices' in r); return r; } });
  const c = await clarified({ ...payload, mode: 'live' }); const clarifiedData = eventResponseSchema.parse(await c.json()); assert.ok('kind' in clarifiedData); assert.equal(clarifiedData.kind, 'clarification'); assert.equal(eventCalls, 1, 'no event provider while location is ambiguous');
  const stale = await make({ search: async () => { version++; return f.events; } }, resolver);
  assert.equal((await stale({ ...payload, mode: 'live' })).status, 409); version = 1;
  const errors = await make({ search: async () => { throw Error('apikey=secret raw conversation'); } }, resolver);
  const failure = await errors({ ...payload, mode: 'live' }); assert.equal(failure.status, 503); assert.ok(!(await failure.text()).includes('secret'));
  await live({ ...payload, mode: 'live' }); assert.equal((await live({ ...payload, mode: 'live' })).status, 429);
  for (let n = 0; n < 4; n++) { clock += 61000; assert.equal((await live({ ...payload, mode: 'live' })).status, 200); assert.equal((await live({ ...payload, mode: 'live' })).status, 200); }
  clock += 61000; assert.equal((await live({ ...payload, mode: 'live' })).status, 429);
  assert.ok(reads > 0); assert.equal(logs, 0);
});

// End-to-end strict result contracts, not just adapter field assertions.
test('shared Geoapify resolver strips clarification ID from resolved area for strict Places and Events results', async () => {
  let calls = 0;
  const provider = new GeoapifyProvider('synthetic-key', (async () => {
    calls++; return calls % 2 === 1 ? Response.json({ results: [{ country_code: 'us', result_type: 'postcode', place_id: 'provider-choice', postcode: '02108', formatted: 'Boston, MA 02108', city: 'Boston', state_code: 'MA', lat: 42.357, lon: -71.063, timezone: { name: 'America/New_York' } }] }) : Response.json({ features: [] });
  }) as typeof fetch);
  const found = await provider.search({ area: '02108', radiusKm: 5, category: 'any' }, new AbortController().signal); assert.ok('area' in found);
  assert.equal('id' in found.area, false); assert.ok(areaSchema.safeParse(found.area).success);
  assert.ok(placeResultsSchema.safeParse({ mode: 'live', retrievedAt: stamp, ...evaluatePlaces(found.candidates, found.area, { ...demoPlaceQuery, area: '02108' }, demoPlaceSummary()) }).success);
  const resolved = await provider.resolve({ area: '02108' }, new AbortController().signal); assert.ok('area' in resolved);
  assert.ok(eventResultsSchema.safeParse({ mode: 'live', retrievedAt: stamp, area: resolved.area, query, ...evaluateEvents(fixture().events, resolved.area, query, demoPlaceSummary()) }).success);
  assert.equal(calls, 3, 'event resolution does not request places');
});
