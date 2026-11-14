import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { applyWorkChange, evaluateEvents, evaluatePlaces, makeWork, workFixture, workReportSchema, workApplyReplySchema, travelCheck, visitEvidenceSchema, workRequestSchema } from '@fuzl/planning';
import { createApp } from '../app.js';
import { AdjustmentCache, workHash } from './cache.js';
import { ExtractionError } from '../extraction/errors.js';

test('bounded time change uses the smallest supported shift, rejects exclusion of a confirmed person and keeps unknown price unresolved', () => {
  const f = workFixture('time'), original = structuredClone(f), r = makeWork(f.context, f.summary, [], f.memories);
  assert.equal(r.state, 'suggestions'); assert.equal(r.suggestions.length, 1); const s = r.suggestions[0]; assert.equal(s.delta, -30); assert.equal(s.fits, 1); assert.equal(s.stillNeedsChecking, 1);
  assert.equal(s.affected.some(o => o.name.includes('exclude someone')), false); assert.equal(s.affected.find(o => o.name.includes('price unknown'))?.state, 'still-needs-checking'); assert.ok(s.affected.find(o => o.name.includes('price unknown'))?.remaining.some(r => /cost|Affordability/i.test(r)));
  assert.deepEqual(f, original, 'preview mutates neither source nor facts nor candidates');
  const duplicated = structuredClone(f); if (duplicated.context.kind === 'places') duplicated.context.candidates.push({ ...duplicated.context.candidates[0], sourceUrl: 'https://example.com/duplicate-id' }, { ...duplicated.context.candidates[0], id: 'duplicate-url' });
  assert.equal(makeWork(duplicated.context, duplicated.summary).suggestions[0].fits, 1, 'duplicate provider IDs or URLs never inflate counts');
  const next = applyWorkChange(f.context, f.summary, s); assert.equal(next.context.kind, 'places'); if (next.context.kind === 'places') assert.equal(next.context.query.start, '18:30');
  assert.equal(next.summary.facts.find(f => f.id === 'sam-availability')?.strength, 'firm'); assert.deepEqual(next.summary.sources, original.summary.sources);
  const blocked = workFixture('time'); blocked.summary.facts.forEach(f => { if (f.kind === 'schedule' && f.strength === 'firm') f.startTime = '19:00'; }); assert.equal(makeWork(blocked.context, blocked.summary).suggestions.length, 0);
});
test('known travel estimates permit only the smallest flexible increase; radius, wrong mode/date/address and firm bounds cannot substitute', () => {
  const f = workFixture('travel'), r = makeWork(f.context, f.summary); assert.equal(r.suggestions[0].kind, 'travel-limit'); assert.equal(r.suggestions[0].delta, 6); assert.equal(r.suggestions[0].fits, 1);
  const radius = workFixture('radius-only'); assert.equal(makeWork(radius.context, radius.summary).suggestions.length, 0); assert.match(makeWork(radius.context, radius.summary).message, /estimate|Radius/);
  const firm = workFixture('firm-travel'); assert.equal(makeWork(firm.context, firm.summary, [], f.memories).suggestions.length, 0);
  assert.equal(f.context.kind, 'places'); if (f.context.kind !== 'places') return; const candidate = f.context.candidates[0], cap = f.summary.facts.find(f => f.id === 'flex-travel'); assert.ok(cap?.kind === 'travel');
  const window = { date: f.context.query.date, start: f.context.query.start, end: f.context.query.end, timeZone: f.context.query.timeZone };
  assert.equal(travelCheck({ ...cap, maxMinutes: 26, comparison: 'under' }, candidate.visit, window, candidate.address).status, 'does-not-fit');
  for (const patch of [{ destination: 'Another venue' }, { date: '2026-11-15' }, { arrival: '18:30' }, { mode: 'walking' as const }]) assert.equal(travelCheck(cap, { ...candidate.visit, travel: { ...candidate.visit!.travel!, ...patch } }, window, candidate.address).status, 'needs-checking');
  const max = structuredClone(f); if (max.context.kind === 'places') max.context.candidates[0].visit!.travel!.minutes = 31; assert.equal(makeWork(max.context, max.summary).suggestions.length, 0);
});
test('booking, unknown availability, DST, firm budgets and unreviewed or firm facts cannot become a verified fit through relaxation or memory', () => {
  const f = workFixture('time'); if (f.context.kind !== 'places') throw Error();
  f.context.candidates.forEach(c => { delete c.visit; }); const booking = makeWork(f.context, f.summary, [], f.memories); assert.ok(booking.suggestions.every(s => s.fits === 0)); assert.ok(booking.suggestions[0].affected.every(o => o.state === 'still-needs-checking'));
  const unknown = workFixture(); unknown.summary.facts = unknown.summary.facts.filter(f => f.id !== 'sam-availability'); assert.equal(makeWork(unknown.context, unknown.summary).suggestions[0].fits, 0);
  const budget = workFixture(); if (budget.context.kind === 'places') budget.context.candidates.forEach(c => { c.price.amount = 500; c.price.currency = 'USD'; c.price.coverage = 'total'; c.price.basis = 'per-person'; }); assert.equal(makeWork(budget.context, budget.summary, [], budget.memories).suggestions.length, 0);
  const access = workFixture(); access.summary.facts.push({ id: 'firm-access', kind: 'preference', subject: { kind: 'group' }, status: 'confirmed', strength: 'firm', sourceIds: [], description: 'Step-free wheelchair access required' }); const accessResult = makeWork(access.context, access.summary); assert.ok(accessResult.suggestions.length); assert.ok(accessResult.suggestions.every(s => s.fits === 0 && s.affected.every(o => o.remaining.some(r => /accessibility/i.test(r)))));
  const rigid = workFixture(); rigid.summary.facts.find(f => f.id === 'flex-window')!.strength = 'firm'; assert.equal(makeWork(rigid.context, rigid.summary).suggestions.length, 0);
  const tentative = workFixture(); tentative.summary.facts.find(f => f.id === 'flex-window')!.status = 'tentative'; assert.equal(makeWork(tentative.context, tentative.summary).suggestions.length, 0);
  const dst = workFixture(); if (dst.context.kind === 'places') dst.context.query.timeZone = null; assert.equal(makeWork(dst.context, dst.summary).suggestions.length, 0);
  assert.equal(visitEvidenceSchema.safeParse({ travel: { minutes: null } }).success, false); assert.equal(workRequestSchema.safeParse({ candidates: [] }).success, false);
});
test('event adjustment changes the flexible group window, never the fixed listing schedule; cancelled events and duration uncertainty remain excluded/unresolved', () => {
  const f = workFixture('events'); if (f.context.kind !== 'events') throw Error();
  const original = structuredClone(f.context.candidates[0].schedule), r = makeWork(f.context, f.summary); assert.equal(r.suggestions[0].delta, -30); assert.equal(r.suggestions[0].fits, 1);
  const next = applyWorkChange(f.context, f.summary, r.suggestions[0]); if (next.context.kind === 'events') assert.deepEqual(next.context.candidates[0].schedule, original);
  assert.equal(evaluateEvents(f.context.candidates, f.context.area, f.context.query, next.summary).verified.length, 1);
  f.context.candidates[0].providerStatus = 'cancelled'; assert.equal(makeWork(f.context, f.summary).suggestions.length, 0);
});
test('private feasibility withholds all adjustment counts and candidate explanations, independent of a private value', () => {
  const f = workFixture(); const r = makeWork(f.context, f.summary, [], f.memories, true); assert.equal(r.state, 'private-checks'); assert.deepEqual(r.suggestions, []); assert.deepEqual(r.options, []); assert.ok(!JSON.stringify(r).includes('Alex')); assert.ok(!JSON.stringify(r).includes('Synthetic sunset'));
});
test('owned preview/apply pins evidence, source snapshot, memory context and revision; retries return one decision; failures are sanitized', async t => {
  const f = workFixture(), subject = 'controlled-owner', sessionId = randomUUID(); let now = Date.now(), version = 'v1', privateChecks = false;
  const cache = new AdjustmentCache(() => now), put = () => cache.put({ subject, sessionId, revision: 1, contextVersion: version, summaryKey: workHash(f.summary), context: f.context, mode: 'demo' }); let snapshotId = put();
  const store = { context: async (s: string, id: string, r: { sessionRevision: number }) => { if (s !== subject || id !== sessionId) throw new ExtractionError(404, 'unavailable', 'Unavailable'); if (r.sessionRevision !== 1) throw new ExtractionError(409, 'changed', 'Revision changed'); return { version, memories: f.memories, privateSpending: privateChecks ? [{ state: 'known', amount: 17.31, currency: 'USD' }] : [] }; } };
  let logs = 0; t.mock.method(console, 'error', () => { logs++; });
  const server = createApp({ accounts: { verify: async s => s === 'controlled-owner-token' ? subject : 'another', adjustments: { cache, store: () => store, now: () => now } } }).listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
  const url = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/private/sessions/${sessionId}/adjustments/`;
  const call = (path: string, body: unknown, auth = 'controlled-owner-token') => fetch(url + path, { method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const input = () => ({ snapshotId, sessionRevision: 1, summary: f.summary, evidence: [] });
  assert.equal((await call('preview', input(), '')).status, 401); assert.equal((await call('preview', input(), 'controlled-other-token')).status, 404);
  const response = await call('preview', input()); assert.equal(response.status, 200); const preview = workReportSchema.parse(await response.json()); assert.equal(response.headers.get('cache-control'), 'no-store, private');
  const apply = { ...input(), previewId: preview.previewId, suggestionId: preview.suggestions[0].id, approved: true };
  const first = workApplyReplySchema.parse(await (await call('apply', apply)).json()); assert.equal(first.summary.organizerDecisions?.length, 1); assert.deepEqual(first.summary.sources, f.summary.sources); assert.equal(first.query?.start, '18:30');
  const retry = workApplyReplySchema.parse(await (await call('apply', apply)).json()); assert.deepEqual(retry.decision, first.decision);
  const altered = structuredClone(apply); altered.summary.facts[0] = { ...altered.summary.facts[0], strength: 'flexible' }; assert.equal((await call('apply', altered)).status, 409);
  assert.equal((await call('apply', { ...apply, evidence: [{ key: 'demo:unknown', evidence: {} }] })).status, 400);
  version = 'memory-changed'; assert.equal((await call('apply', apply)).status, 409); version = 'v1';
  now += 61000; snapshotId = put(); assert.equal((await call('apply', apply)).status, 410, 'new candidate generation rejects older preview');
  privateChecks = true; const redacted = await call('preview', input()); assert.equal(redacted.status, 200); const text = await redacted.text(); assert.ok(!text.includes('17.31')); assert.ok(!text.includes('Synthetic sunset')); assert.deepEqual(workReportSchema.parse(JSON.parse(text)).suggestions, []);
  now += 600001; assert.equal((await call('preview', input())).status, 410); assert.equal(logs, 0);
});
test('applied proof survives reevaluation only for its date/window, mode, shared origin and exact destination', () => {
  const f = workFixture('travel'); if (f.context.kind !== 'places') throw Error(); const c = f.context.candidates[0], s = makeWork(f.context, f.summary).suggestions[0], adjusted = applyWorkChange(f.context, f.summary, s);
  assert.equal(adjusted.context.kind, 'places'); if (adjusted.context.kind !== 'places') return;
  assert.equal(evaluatePlaces(adjusted.context.candidates, adjusted.context.area, adjusted.context.query, adjusted.summary).verified.length, 1);
  c.visit!.travel!.destination = 'Old address'; assert.equal(makeWork(f.context, f.summary).suggestions.length, 0);
});
