import { createApp } from '../app.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availabilityFor, participationFixture, summaryForScope, evaluatePlaces, evaluateEvents, participationChecks, scopeWindowSchema, scopeWindowEnd, windowWithin, scopeResultSchema, shortlistPlace, makeWork, detailsFromOption, materialPlanKey, travelCheck, bookingCheck, retainedVisitChecks } from '@fuzl/planning';
import type { ParticipationScope } from '@fuzl/planning';
const f = participationFixture();
const scope = (subset: boolean): ParticipationScope => ({ mode: subset ? 'available' : 'everyone', attendeeCount: subset ? 4 : 6, window: f.window, expiresAt: '2026-11-15T02:00:00Z', reviewed: true, key: 'a'.repeat(64), roster: f.summary.participants.map((p, i) => ({ ...p, selected: !subset || i < 4, availability: i < 4 ? 'confirmed' : i === 4 ? 'unavailable' : 'missing' })) });
test('six intended attendees cannot fit while four explicitly reviewed opt-ins can; original group and source summary stay unchanged', () => {
  const original = structuredClone(f.summary), everyone = scope(false), four = scope(true);
  const all = evaluatePlaces([f.candidate], f.area, f.query, f.summary, [], [], undefined, everyone); assert.equal(all.verified.length, 0); assert.equal(all.excluded.length, 1); assert.ok(all.excluded[0].checks.some(c => c.detail.includes('missing reply')));
  const checked = summaryForScope(f.summary, four), result = evaluatePlaces([f.candidate], f.area, f.query, checked, [], [], undefined, four); assert.equal(result.verified.length, 1); assert.equal(checked.facts.filter(x => x.kind === 'budget').length, 4); assert.deepEqual(f.summary, original); assert.equal(f.summary.participants.length, 6);
  const publicOption = shortlistPlace(result.verified[0], crypto.randomUUID()); assert.ok(!('participation' in publicOption));
  const draft = { ballotId: crypto.randomUUID(), option: publicOption, details: { ...detailsFromOption(publicOption), attendanceScope: { mode: 'available' as const, count: 4 } }, scopeProof: { scopeKey: 'a'.repeat(64), rosterKey: 'b'.repeat(64) } }; assert.notEqual(materialPlanKey(draft), materialPlanKey({ ...draft, scopeProof: { ...draft.scopeProof, rosterKey: 'c'.repeat(64) } }), 'a different roster with the same public count is a material plan change');
});
test('scope projection retains selected personal/group/unattributed firm constraints and private server checks; no preference can promote failed requirements', () => {
  const four = scope(true), summary = structuredClone(f.summary); summary.facts.find(x => x.id === 'budget-person-4' && x.kind === 'budget')!.status = 'confirmed';
  const budget = summary.facts.find(x => x.id === 'budget-person-4'); if (budget?.kind === 'budget') budget.amount = 10;
  const evaluate = (s = summary, privateLimits: { amount: number; currency: string; state: string }[] = []) => evaluatePlaces([f.candidate], f.area, f.query, summaryForScope(s, four), privateLimits, [{ sourceUrl: f.candidate.sourceUrl, date: f.window.date, takeaway: 'Approved positive feedback', sentiment: 'positive' }], undefined, four);
  assert.equal(evaluate().excluded.length, 1);
  assert.equal(evaluate(f.summary, [{ amount: 10.31, currency: 'USD', state: 'known' }]).excluded.length, 1); assert.ok(!JSON.stringify(evaluate(f.summary, [{ amount: 10.31, currency: 'USD', state: 'known' }])).includes('10.31'));
  const attendeeIds = four.roster.filter(p => p.selected).map(p => p.id), tagged = { travel: { ...f.candidate.visit.travel, attendeeIds }, booking: { ...f.candidate.visit.booking, attendeeIds } }; const travelFact = f.summary.facts.find(x => x.kind === 'travel')!; assert.ok(travelFact.kind === 'travel');
  assert.equal(travelCheck(travelFact, tagged, f.window, f.candidate.address, attendeeIds).status, 'fits'); assert.equal(travelCheck(travelFact, tagged, f.window, f.candidate.address, f.summary.participants.map(p => p.id)).status, 'needs-checking'); assert.equal(bookingCheck(tagged, f.window, f.candidate.address, f.summary.participants.map(p => p.id)).status, 'needs-checking');
  const common = { kind: 'travel-limit' as const, factId: 'travel-person-1', before: '20', after: '26', sourceIds: [], reason: 'Synthetic organizer-recorded evidence', recordedAt: '2026-11-14T22:00:00Z' };
  const combined = retainedVisitChecks({ ...f.candidate, visit: undefined } as import('@fuzl/planning').PlaceCandidate, { ...f.summary, organizerDecisions: [{ ...common, id: 'earlier-travel', checks: [{ key: 'demo:' + f.candidate.id, evidence: { travel: tagged.travel } }] }, { ...common, id: 'later-booking', checks: [{ key: 'demo:' + f.candidate.id, evidence: { booking: { ...tagged.booking, attendeeIds: f.summary.participants.map(p => p.id) } } }] }] });
  assert.equal(combined.visit?.travel?.attendeeIds?.length, 4); assert.equal(combined.visit?.booking?.attendeeIds?.length, 6); assert.equal(travelCheck(travelFact, combined.visit, f.window, f.candidate.address, f.summary.participants.map(p => p.id)).status, 'needs-checking', 'a newer access check cannot expand the roster of an older travel estimate');
  const travel = structuredClone(f.summary); const t = travel.facts.find(x => x.id === 'travel-person-4'); if (t?.kind === 'travel') t.maxMinutes = 10; assert.equal(evaluate(travel).excluded.length, 1);
  const access = structuredClone(f.summary); access.facts.push({ id: 'access', kind: 'preference', subject: { kind: 'participant', participantId: 'person-4' }, strength: 'firm', status: 'confirmed', sourceIds: [], description: 'Needs step-free access' }); assert.equal(evaluate(access).verified.length, 0);
  access.facts.at(-1)!.subject = { kind: 'unknown' }; assert.ok(summaryForScope(access, four).facts.some(x => x.id === 'access')); assert.equal(evaluate(access).verified.length, 0);
});
test('missing, tentative, conflicting and wrong-window availability stay separate; explicit opt-in never waives an existing firm time bound', () => {
  assert.equal(availabilityFor(f.summary, 'person-6', f.window), 'missing'); assert.equal(availabilityFor(f.summary, 'person-1', f.window, 'tentative'), 'tentative');
  const s = structuredClone(f.summary); s.facts.push({ id: 'firm-time', kind: 'schedule', subject: { kind: 'participant', participantId: 'person-1' }, status: 'confirmed', strength: 'firm', sourceIds: [], exactDate: f.window.date, startTime: '20:00', endTime: '21:00', description: 'Not before 8' });
  assert.equal(availabilityFor(s, 'person-1', f.window, 'yes'), 'conflicting'); assert.equal(windowWithin({ ...f.window, start: '18:30' }, f.window), false);
  assert.ok(participationChecks(scope(true), { ...f.window, end: null }).some(c => c.status === 'needs-checking'));
  assert.ok(!participationChecks(scope(false), { ...f.window, date: '2026-11-15', end: null }).some(c => c.detail.includes('explicitly reported unavailable')), 'a No for the old window must not become unavailability on a different date');
  const factOnly = { ...scope(false), roster: scope(false).roster.slice(0, 1).map(p => ({ ...p, evidence: 'planning-fact' as const, availability: 'confirmed' as const })), attendeeCount: 1 };
  assert.ok(participationChecks(factOnly, { ...f.window, timeZone: 'Asia/Tokyo' }, undefined, 'America/New_York').some(c => c.status === 'needs-checking'));
  assert.equal(scopeWindowSchema.safeParse({ ...f.window, date: '2026-02-30' }).success, false);
  assert.equal(scopeWindowSchema.safeParse({ ...f.window, end: '18:00' }).success, false);
  const day = { ...f.window, allDay: true, start: '00:00', end: '23:59' }; assert.ok(scopeWindowSchema.safeParse(day).success); assert.equal(scopeWindowEnd(day), Date.parse('2026-11-15T05:00:00Z')); assert.equal(windowWithin({ ...f.window, start: '23:00', end: '23:59' }, day), true);
  assert.equal(scopeResultSchema.safeParse({ ...scope(true), roster: Array.from({ length: 21 }, () => scope(true).roster[0]) }).success, false);
});
test('events cannot borrow opt-ins for another date, unknown duration or time zone; attendance metadata never changes event schedule or status', () => {
  const c = f.candidate, event = { id: 'synthetic-event', title: 'Synthetic evening event', source: 'demo' as const, sourceUrl: c.sourceUrl, retrievedAt: c.retrievedAt, providerStatus: 'scheduled', venue: { name: 'Synthetic garden', address: c.address, city: 'Columbus', state: 'OH', lat: c.lat, lon: c.lon }, schedule: { date: f.window.date, time: '19:00', endDate: f.window.date, endTime: '21:00', timeZone: f.window.timeZone, utcStart: null, dateUncertain: false, timeUncertain: false, zoneConflict: false }, price: { amount: 12, currency: 'USD', kind: 'total' as const, basis: 'per-person' as const, fees: 'included' as const }, visit: c.visit };
  const query = { area: f.query.area, radiusKm: 5, from: f.window.date, to: f.window.date }, four = scope(true), summary = summaryForScope(f.summary, four);
  assert.equal(evaluateEvents([event], f.area, query, summary, [], [], undefined, four).verified.length, 1);
  assert.equal(evaluateEvents([{ ...event, schedule: { ...event.schedule, endTime: null } }], f.area, query, summary, [], [], undefined, four).verified.length, 0);
  assert.equal(evaluateEvents([{ ...event, providerStatus: 'cancelled' }], f.area, query, summary, [], [], undefined, four).excluded.length, 1);
  assert.ok(!JSON.stringify(summary).includes('responseId'));
});

test('Make this work cannot reuse subset opt-ins outside their window or waive an unavailable full-group attendee during an overlapping shift', () => {
  const summary = structuredClone(f.summary); summary.facts.push({ id: 'flex-window', kind: 'schedule', subject: { kind: 'group' }, status: 'confirmed', strength: 'flexible', sourceIds: [], exactDate: f.window.date, startTime: f.window.start, endTime: f.window.end, description: 'Preferred outing time' });
  const candidate = { ...f.candidate, hours: { ...f.candidate.hours, start: '18:00', end: '20:00' } };
  const context = { kind: 'places' as const, candidates: [candidate], area: f.area, query: f.query }, four = scope(true);
  const report = makeWork(context, summaryForScope(summary, four), [], [], false, four); assert.ok(!report.suggestions.some(s => s.kind === 'start-time'));
  summary.facts.push({ id: 'whole-group-availability', kind: 'schedule', subject: { kind: 'group' }, status: 'confirmed', strength: 'firm', sourceIds: [], exactDate: f.window.date, startTime: '18:00', endTime: '22:00', description: 'Earlier reported broad availability' });
  const checks = participationChecks(scope(false), { ...f.window, start: '18:00', end: '20:00' }, summary); assert.ok(checks.some(c => c.status === 'does-not-fit' && c.detail.includes('unavailable')));
});

test('new owner and public scope paths reject missing credentials and foreign origins and sanitize storage failures without logging secrets', async t => {
  let logs = 0; t.mock.method(console, 'error', () => { logs++; });
  const fail = () => { throw Error('PRIVATE database URL token raw conversation'); };
  const server = createApp({ accounts: { verify: async () => crypto.randomUUID(), participation: { store: fail } }, guests: { participation: { store: fail } } }).listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`, path = '/private/sessions/' + crypto.randomUUID() + '/participation';
  assert.equal((await fetch(base + path)).status, 401); const response = await fetch(base + path, { headers: { Authorization: 'Bearer synthetic-owner-token' } }); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('PRIVATE'));
  assert.equal((await fetch(base + '/guest/participation')).status, 400);
  const headers = { Authorization: 'Bearer ' + 'a'.repeat(43), 'X-Invite-Token': 'b'.repeat(43), 'Content-Type': 'application/json' };
  assert.equal((await fetch(base + '/guest/participation', { headers: { ...headers, Origin: 'https://another.example' } })).status, 403); const own = await fetch(base + '/guest/participation', { headers }); assert.equal(own.status, 503); assert.equal(own.headers.get('cache-control'), 'no-store, private'); assert.ok(!(await own.text()).includes('PRIVATE')); assert.equal(logs, 0);
});
