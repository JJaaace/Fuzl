import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ballotOptionSchema, canPlanTransition, detailsFromOption, materialPlanKey, planDraftSchema, publishedDetailsSchema, publishablePlan, rsvpCreateSchema, rsvpPayloadSchema } from '@fuzl/planning';
import { createApp } from '../app.js';
const option = () => ballotOptionSchema.parse({ id: randomUUID(), kind: 'idea', name: 'Synthetic walk', time: 'Maybe Friday', location: null, cost: { amount: null, currency: null, kind: 'unknown', basis: 'unknown' }, links: [], unresolved: ['Hours, travel and tickets unknown'], sample: true });
test('clear publication details preserve uncertainty and reject missing/invalid/ambiguous local clocks; zero is not unknown', () => {
  const o = option(), draft = detailsFromOption(o); assert.equal(draft.date, null); assert.equal(draft.time, null); assert.equal(draft.timeZone, null); assert.equal(draft.meetingPoint, null); assert.equal(draft.cost.amount, null); assert.equal(draft.booking, 'needs-booking');
  assert.equal(publishablePlan(draft), false);
  const complete = { ...draft, date: '2026-11-21', time: '15:00', timeZone: 'America/New_York', meetingPoint: 'North gate' };
  assert.ok(publishedDetailsSchema.safeParse(complete).success);
  for (const patch of [{ meetingPoint: null }, { meetingPoint: ' ' }, { date: '2026-02-30' }, { timeZone: null }, { date: '2026-11-01', time: '01:30' }, { date: '2026-03-08', time: '02:30' }]) assert.equal(publishedDetailsSchema.safeParse({ ...complete, ...patch }).success, false);
  assert.equal(publishedDetailsSchema.parse({ ...complete, cost: { amount: 0, currency: 'USD', kind: 'starting', basis: 'per-person' } }).cost.amount, 0);
  assert.equal(publishedDetailsSchema.safeParse({ ...complete, privateBudget: 17.31 }).success, false);
});
test('material fingerprint tracks time/location/date/activity/cost/option changes, but not instructions/booking notes; terminal lifecycle cannot reopen', () => {
  const draft = planDraftSchema.parse({ ballotId: randomUUID(), option: option(), details: { ...detailsFromOption(option()), date: '2026-11-21', time: '15:00', timeZone: 'America/New_York', meetingPoint: 'Gate' } });
  const key = materialPlanKey(draft);
  for (const patch of [{ date: '2026-11-22' }, { time: '16:00' }, { timeZone: 'America/Chicago' }, { meetingPoint: 'Another gate' }, { activity: 'Museum' }, { cost: { ...draft.details.cost, amount: 2 } }]) assert.notEqual(materialPlanKey({ ...draft, details: { ...draft.details, ...patch } }), key);
  assert.equal(materialPlanKey({ ...draft, details: { ...draft.details, instructions: 'Bring water', booking: 'organizer-reported-booked' } }), key);
  for (const [from, to] of [['proposed', 'confirmed'], ['confirmed', 'completed'], ['confirmed', 'cancelled']] as const) assert.ok(canPlanTransition(from, to));
  assert.equal(canPlanTransition('cancelled', 'confirmed'), false); assert.equal(canPlanTransition('completed', 'confirmed'), false); assert.equal(canPlanTransition('proposed', 'completed'), false);
  assert.equal(rsvpPayloadSchema.safeParse({ alias: 'Sam', choice: 'going', planVersion: 1, approved: false }).success, false);
  assert.equal(rsvpCreateSchema.safeParse({ alias: 'Same name', choice: 'going' }).success, false);
});
test('plan route safety uses scoped credentials, origin/body limits and sanitized storage errors without logging tokens/conversations', async t => {
  let logs = 0; t.mock.method(console, 'error', () => { logs++; });
  const server = createApp({ plans: { store: () => { throw Error('secret connection private conversation'); } } }).listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`, headers = { Authorization: `Bearer ${'a'.repeat(43)}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(base + '/plan/page')).status, 400); const r = await fetch(base + '/plan/page', { headers }); assert.equal(r.status, 503); assert.equal(r.headers.get('cache-control'), 'no-store, private'); assert.ok(!(await r.text()).includes('secret'));
  assert.equal((await fetch(base + '/plan/page', { headers: { ...headers, Origin: 'https://not-allowed.example' } })).status, 403);
  assert.equal((await fetch(base + '/plan/rsvps', { method: 'POST', headers, body: JSON.stringify({ raw: 'x'.repeat(18000) }) })).status, 413);
  assert.equal(logs, 0);
});
