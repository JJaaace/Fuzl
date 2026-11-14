import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { OrganizerStore } from '../accounts/store.js';
import { GuestStore } from '../guests/store.js';
import { PlaceStore } from '../places/store.js';
import { ParticipationStore } from './store.js';
import { BallotStore } from '../ballots/store.js';
import { PlanStore } from '../plans/store.js';
import { createApp } from '../app.js';
import { participationFixture, placeResultsSchema } from '@fuzl/planning';
const enabled = process.env.FUZL_DISPOSABLE_DATABASE === 'owned-by-test-runner' && !!process.env.FUZL_TEST_DATABASE_URL;
const id = () => randomUUID(), token = () => randomBytes(32).toString('base64url');
test('10.4 real disposable six-person scope → credential opt-ins → explicit subset → private fit → stale reply/expiry/isolation', { skip: !enabled }, async t => {
  const url = process.env.FUZL_TEST_DATABASE_URL!; assert.equal(new URL(url).hostname, '127.0.0.1'); const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: 'fuzl' }), log: [] }); t.after(() => db.$disconnect());
  let now = Date.parse('2026-11-14T22:00:00Z'), providerCalls = 0; const f = participationFixture(), owner = id(), other = id(), clock = () => now;
  const organizers = new OrganizerStore(db), guests = new GuestStore(db, clock), scopes = new ParticipationStore(db, clock), checks = new PlaceStore(db, clock);
  const group = await organizers.createGroup(owner, { name: 'Synthetic six-person group', aliases: f.summary.participants.map(p => p.name!) }), otherGroup = await organizers.createGroup(owner, { name: 'Synthetic independent group', aliases: [] });
  const payload = { title: 'Synthetic tonight', summaryVersion: 1 as const, origin: 'manual' as const, summary: f.summary, provenance: [] }, saved = await organizers.createSession(owner, group.id, payload), foreign = await organizers.createSession(owner, otherGroup.id, payload);
  const server = createApp({ guests: { store: () => guests, now: clock, participation: { store: () => scopes } }, accounts: { verify: async s => s === 'synthetic-owner-bearer' ? owner : other, participation: { store: () => scopes }, places: { store: () => checks, provider: { search: async () => { providerCalls++; return { area: f.area, candidates: [f.candidate] }; } }, now: clock }, adjustments: { store: () => checks, now: clock } } }).listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`, prefix = `/private/sessions/${saved.id}`;
  const call = (path: string, method = 'GET', body?: unknown, auth = 'synthetic-owner-bearer', invite?: string) => fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', ...(invite ? { 'X-Invite-Token': invite } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let dashboard = await scopes.get(owner, saved.id), invite = '', result: import('@fuzl/planning').PlaceResults; const people: { responseId: string; edit: string; payload: import('@fuzl/planning').ResponseInput }[] = [];
  const mutation = () => ({ requestId: id(), revision: dashboard.revision, sessionRevision: 1, approved: true as const });
  async function review(mode: 'everyone' | 'available', omitElliot = false) { dashboard = await scopes.get(owner, saved.id); dashboard = await scopes.review(owner, saved.id, { ...mutation(), expectedKey: dashboard.scope.key, mappings: people.flatMap((p, i) => omitElliot && i === 4 ? [] : [{ responseId: p.responseId, participantId: f.summary.participants[i].id }]), selected: mode === 'available' ? f.summary.participants.slice(0, 4).map(p => p.id) : [], mode }); }
  const search = async (recheck = false) => { if (!recheck) now += 61001; const response = await call(prefix + `/places/${recheck ? 'evaluate' : 'search'}`, 'POST', { mode: 'live', sessionRevision: 1, summary: f.summary, query: f.query, manual: [], ...(recheck ? { searchId: result.searchId } : {}) }); if (response.ok) result = placeResultsSchema.parse(await response.json()); return response; };
  await t.test('default roster is everyone; window creates existing guest invite with exact expiration and safe idempotent retries', async () => {
    assert.equal(dashboard.scope.mode, 'everyone'); assert.equal(dashboard.scope.attendeeCount, 6); assert.ok(dashboard.scope.roster.every(p => p.availability === 'missing'));
    const input = { ...mutation(), window: f.window, replace: false, inviteToken: token() }; const a = await scopes.window(owner, saved.id, input), b = await scopes.window(owner, saved.id, input); assert.equal(a.token, b.token); invite = a.token; dashboard = b.dashboard; assert.equal(await db.guestInvite.count({ where: { sessionId: saved.id } }), 1);
    assert.equal(dashboard.scope.expiresAt, '2026-11-15T02:00:00.000Z'); const form = await guests.form(invite); assert.deepEqual(form.participation?.window, f.window); assert.ok(!JSON.stringify(form).includes('roster'));
    assert.equal((await call(prefix + '/participation', 'GET', undefined, 'synthetic-other-bearer')).status, 404);
  });
  await t.test('five credential-owned replies record four explicit Yes opt-ins, one No and a missing sixth; shared invite and names grant no edit permission', async () => {
    const form = await guests.form(invite), questionId = form.questions[0].id;
    for (let i = 0; i < 5; i++) { const edit = token(), payload = { alias: f.summary.participants[i].name!, answers: [{ questionId, kind: 'budget' as const, state: 'known' as const, amount: [25, 20, 18, 14.31, .17][i], currency: 'USD', visibility: 'private' as const }] }; const response = await guests.submit(invite, { submissionId: id(), editToken: edit, payload }); people.push({ responseId: response.id, edit, payload }); const request = { requestId: id(), revision: 0, choice: i === 4 ? 'no' as const : 'yes' as const }; const first = await scopes.reply(invite, edit, request), again = await scopes.reply(invite, edit, request); assert.equal(first.revision, again.revision); }
    assert.equal((await scopes.get(owner, saved.id)).replies.length, 5); assert.equal((await scopes.own(invite, people[0].edit)).choice, 'yes');
    await assert.rejects(scopes.own(invite, invite)); await assert.rejects(scopes.own(invite, token()));
    const own = await call('/guest/participation', 'GET', undefined, people[0].edit, invite); assert.equal(own.status, 200); const text = await own.text(); for (const secret of ['roster', '14.31', 'Elliot', 'mappings']) assert.ok(!text.includes(secret));
    assert.equal((await call('/guest/participation', 'PUT', { requestId: id(), revision: 1, choice: 'no', responseId: people[1].responseId }, people[0].edit, invite)).status, 400);
  });
  await t.test('full-group checks show unavailable and missing people and private constraints; explicit four-person review rechecks the same candidates without a provider request', async () => {
    await review('everyone'); assert.equal((await search()).status, 200); assert.equal(result!.verified.length, 0); assert.equal(result!.participation?.attendeeCount, 6); assert.equal(result!.participation?.roster[4].availability, 'unavailable'); assert.equal(result!.participation?.roster[5].availability, 'missing');
    const oldWork = result!.workId, beforeCalls = providerCalls; await review('available'); assert.equal(dashboard.scope.attendeeCount, 4); assert.equal((await search(true)).status, 200); assert.equal(providerCalls, beforeCalls); assert.equal(result!.verified.length, 1); assert.equal(result!.participation?.attendeeCount, 4);
    for (const secret of ['14.31', '0.17', people[0].edit, 'privateSpending']) assert.ok(!JSON.stringify(result!).includes(secret));
    const oldPreview = await call(prefix + '/adjustments/preview', 'POST', { snapshotId: oldWork, sessionRevision: 1, summary: f.summary, evidence: [] }); assert.ok([409, 410].includes(oldPreview.status));
    assert.deepEqual((await organizers.getSession(owner, saved.id)).payload.summary, f.summary); assert.equal((await organizers.listGroups(owner)).find(g => g.id === group.id)?.aliases.length, 6);
  });
  await t.test('unmatched private limits remain in force; a selected guest’s lower private budget cannot be waived by using a subset', async () => {
    await review('available', true); assert.equal((await search(true)).status, 200); assert.equal(result!.verified.length, 0); assert.equal(result!.excluded.length, 1);
    await review('available'); assert.equal((await search(true)).status, 200); assert.equal(result!.verified.length, 1);
    await guests.edit(invite, people[3].edit, { revision: 1, payload: { ...people[3].payload, answers: people[3].payload.answers.map(a => a.kind === 'budget' ? { ...a, amount: 10.31 } : a) } });
    assert.equal((await search(true)).status, 409, 'reply edit invalidates scope before fit checks'); await review('available'); assert.equal((await search()).status, 200); assert.equal(result!.verified.length, 0); assert.ok(result!.excluded[0].checks.some(c => c.kind === 'private-budget' && c.status === 'does-not-fit')); assert.ok(!JSON.stringify(result!).includes('10.31'));
  });
  await t.test('credential-scoped changes invalidate review, retries remain idempotent, and tentative or stale identities cannot join', async () => {
    const input = { requestId: id(), revision: 1, choice: 'tentative' as const }; await scopes.reply(invite, people[0].edit, input); assert.equal((await scopes.reply(invite, people[0].edit, input)).revision, 2); assert.equal((await scopes.own(invite, people[1].edit)).choice, 'yes'); assert.equal((await search(true)).status, 409);
    dashboard = await scopes.get(owner, saved.id); await assert.rejects(scopes.review(owner, saved.id, { ...mutation(), expectedKey: dashboard.scope.key, mappings: people.map((p, i) => ({ responseId: p.responseId, participantId: f.summary.participants[i].id })), selected: ['person-1'], mode: 'available' }));
    await assert.rejects(scopes.reply(invite, people[0].edit, { ...input, requestId: id() })); await scopes.reply(invite, people[0].edit, { requestId: id(), revision: 2, choice: 'yes' }); await review('available');
    const otherDashboard = await scopes.get(owner, foreign.id); assert.equal(otherDashboard.scope.mode, 'everyone'); assert.equal(otherDashboard.replies.length, 0); assert.ok(otherDashboard.scope.roster.every(p => p.availability === 'missing'));
  });
  await t.test('scope changes preserve published snapshots until explicit copy/preview/publication, then RSVP reconfirmation follows the material roster change', async () => {
    const ballots = new BallotStore(db, clock), plans = new PlanStore(db, clock), option = { id: id(), kind: 'idea' as const, name: 'Synthetic scope-publication outing', time: null, location: 'Synthetic meeting point', cost: { amount: null, currency: null, kind: 'unknown' as const, basis: 'unknown' as const }, links: [], unresolved: ['Total cost and current booking need checking'], sample: true };
    await ballots.save(owner, saved.id, { revision: 0, sessionRevision: 1, content: { title: 'Synthetic scope ballot', options: [option] } });
    const ballot = await ballots.publish(owner, saved.id, { publicationId: id(), inviteToken: token(), expectedBallotId: null, shortlistRevision: 1, sessionRevision: 1, approved: true, days: 14 });
    let plan = (await plans.select(owner, saved.id, { requestId: id(), revision: 0, sessionRevision: 1, ballotId: ballot.ballot.id, optionId: option.id }))!;
    plan = (await plans.save(owner, saved.id, { requestId: id(), revision: plan.revision, details: { ...plan.draft.details, date: f.window.date, time: f.window.start, timeZone: f.window.timeZone, meetingPoint: 'Synthetic meeting point' } }))!;
    await assert.rejects(plans.publish(owner, saved.id, { requestId: id(), revision: plan.revision, previewKey: plan.draftKey, approved: true, notice: 'Configured attendance scope must be copied before publication.' }));
    plan = (await plans.attachScope(owner, saved.id, { requestId: id(), revision: plan.revision }))!; assert.equal(plan.draft.details.attendanceScope?.count, 4);
    await assert.rejects(plans.save(owner, saved.id, { requestId: id(), revision: plan.revision, details: { ...plan.draft.details, attendanceScope: { mode: 'available', count: 5 } } }));
    plan = (await plans.publish(owner, saved.id, { requestId: id(), revision: plan.revision, previewKey: plan.draftKey, approved: true, notice: 'Explicit four-person scope; cost and booking remain unknown.' }))!;
    const share = token(), edit = token(); await plans.link(owner, saved.id, { requestId: id(), revision: plan.revision, token: share, days: 14, replace: false }); await plans.submit(share, { submissionId: id(), editToken: edit, payload: { alias: 'Synthetic controlled RSVP', choice: 'going', planVersion: 1, approved: true } });
    await review('everyone'); plan = (await plans.get(owner, saved.id))!; assert.equal(plan.published?.details.attendanceScope?.count, 4); assert.equal(plan.counts.going, 1);
    await assert.rejects(plans.publish(owner, saved.id, { requestId: id(), revision: plan.revision, previewKey: plan.draftKey, approved: true, notice: 'Stale attendance proof must not publish.' }));
    plan = (await plans.attachScope(owner, saved.id, { requestId: id(), revision: plan.revision }))!; assert.equal(plan.draft.details.attendanceScope?.count, 6); assert.equal(plan.published?.details.attendanceScope?.count, 4);
    plan = (await plans.publish(owner, saved.id, { requestId: id(), revision: plan.revision, previewKey: plan.draftKey, approved: true, notice: 'Organizer explicitly published the changed intended roster.' }))!; assert.equal(plan.counts.going, 0); assert.equal(plan.counts.needsReconfirmation, 1);
    const page = await plans.page(share); assert.equal(page.details.attendanceScope?.count, 6); for (const secret of ['scopeProof', 'rosterKey', 'person-1', '14.31', '10.31']) assert.ok(!JSON.stringify(page).includes(secret));
    await plans.edit(share, edit, { requestId: id(), revision: 1, payload: { alias: 'Synthetic controlled RSVP', choice: 'going', planVersion: page.version, approved: true } }); assert.equal((await plans.get(owner, saved.id))?.counts.going, 1);
    await review('available');
  });
  await t.test('an opt-in edit racing an organizer review cannot leave stale approval active, even when the choice stays Yes', async () => {
    dashboard = await scopes.get(owner, saved.id); const own = await scopes.own(invite, people[0].edit);
    const results = await Promise.allSettled([scopes.review(owner, saved.id, { ...mutation(), expectedKey: dashboard.scope.key, mappings: people.map((p, i) => ({ responseId: p.responseId, participantId: f.summary.participants[i].id })), selected: f.summary.participants.slice(0, 4).map(p => p.id), mode: 'available' }), scopes.reply(invite, people[0].edit, { requestId: id(), revision: own.revision, choice: 'yes' })]);
    assert.equal(results[1].status, 'fulfilled'); assert.equal((await scopes.get(owner, saved.id)).scope.reviewed, false); assert.equal((await search(true)).status, 409); await review('available');
  });
  await t.test('expiry/revocation denies reads and writes and stale window reviews cannot authorize another session or a later window', async () => {
    now = Date.parse('2026-11-15T02:00:00Z'); await assert.rejects(scopes.own(invite, people[0].edit)); await assert.rejects(scopes.reply(invite, people[0].edit, { requestId: id(), revision: 3, choice: 'yes' })); await assert.rejects(guests.form(invite)); const before = providerCalls; assert.equal((await search(true)).status, 409); assert.equal(providerCalls, before);
    dashboard = await scopes.get(owner, saved.id); dashboard = await scopes.revoke(owner, saved.id, mutation()); assert.equal(dashboard.scope.mode, 'everyone');
    now = Date.parse('2026-11-14T22:00:00Z'); const old = invite; const a = await scopes.window(owner, saved.id, { ...mutation(), window: { ...f.window, allDay: true, start: '00:00', end: '23:59' }, replace: true, inviteToken: token() }); invite = a.token; dashboard = a.dashboard; assert.equal(dashboard.scope.expiresAt, '2026-11-15T05:00:00.000Z'); assert.equal(dashboard.scope.mode, 'everyone'); assert.ok(dashboard.replies.every(r => !r.currentWindow)); await assert.rejects(scopes.own(old, people[0].edit)); await assert.rejects(scopes.own(invite, people[0].edit));
    await assert.rejects(scopes.review(other, saved.id, { ...mutation(), expectedKey: dashboard.scope.key, mappings: [], selected: [], mode: 'everyone' }));
  });
  await t.test('new tables deny direct public roles and group deletion cascades only this group’s opt-ins', async () => {
    await assert.rejects(db.$transaction(async tx => { await tx.$executeRawUnsafe('SET LOCAL ROLE anon'); await tx.$queryRawUnsafe('SELECT * FROM fuzl.fuzl_scope_opt_ins'); }));
    await organizers.deleteGroup(owner, group.id); assert.equal(await db.sessionScope.count({ where: { sessionId: saved.id } }), 0); assert.equal(await db.scopeOptIn.count(), 0); assert.equal((await organizers.getSession(owner, foreign.id)).id, foreign.id); await organizers.deleteGroup(owner, otherGroup.id);
  });
});
