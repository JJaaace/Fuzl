import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { OrganizerStore } from '../accounts/store.js';
import { BallotStore } from '../ballots/store.js';
import { PlanStore } from './store.js';
import { createApp } from '../app.js';
import { demoPlaceSummary, demoPlaceQuery, demoPlaces, evaluatePlaces, shortlistPlace, planOwnerSchema, publicPlanSchema, ownRsvpSchema } from '@fuzl/planning';
import type { OwnerPlan, PlanDetails } from '@fuzl/planning';
const enabled = process.env.FUZL_DISPOSABLE_DATABASE === 'owned-by-test-runner' && !!process.env.FUZL_TEST_DATABASE_URL;
const token = () => randomBytes(32).toString('base64url');
const requestId = () => randomUUID();
test('Section 8B real saved ballot → vote → plan → RSVP → update → reconfirm on disposable PostgreSQL', { skip: !enabled }, async t => {
  const url = process.env.FUZL_TEST_DATABASE_URL!; assert.equal(new URL(url).hostname, '127.0.0.1');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: 'fuzl' }), log: [] }); t.after(() => db.$disconnect());
  let now = Date.now(); const tick = () => { now += 61000; };
  const owner = randomUUID(), other = randomUUID(), organizer = new OrganizerStore(db), ballots = new BallotStore(db, () => now), plans = new PlanStore(db, () => now);
  const server = createApp({ ballots: { store: () => ballots, now: () => now }, plans: { store: () => plans, now: () => now }, accounts: { verify: async v => v === 'synthetic-owner-bearer' ? owner : other } }).listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
  const group = await organizer.createGroup(owner, { name: 'PRIVATE group', aliases: ['PRIVATE participant'] });
  const summary = demoPlaceSummary(); summary.speakers.push({ id: 's', label: 'PRIVATE speaker', participantId: null }); summary.sources.push({ id: 'q', speakerId: 's', text: 'PRIVATE conversation; private budget 17.31' }); summary.facts[0].sourceIds = ['q'];
  const session = await organizer.createSession(owner, group.id, { title: 'PRIVATE session', summaryVersion: 1, origin: 'manual', provenance: [], summary });
  const found = demoPlaces(demoPlaceQuery, new Date(now).toISOString()); assert.ok('area' in found); const checked = evaluatePlaces(found.candidates, found.area, demoPlaceQuery, summary);
  const option = shortlistPlace(checked.verified[0], randomUUID()), content = { title: 'Synthetic ballot', options: [option, { ...option, id: randomUUID(), name: 'Second synthetic idea' }] };
  await ballots.save(owner, session.id, { content, revision: 0, sessionRevision: 1 });
  const ballotToken = token(), published = await ballots.publish(owner, session.id, { publicationId: requestId(), inviteToken: ballotToken, expectedBallotId: null, shortlistRevision: 1, sessionRevision: 1, approved: true, days: 14 });
  const voteEdit = token(); await ballots.submit(ballotToken, { submissionId: requestId(), editToken: voteEdit, optionId: option.id });
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`, owned = `/private/sessions/${session.id}/plans`;
  const call = (path: string, auth = 'synthetic-owner-bearer', method = 'GET', body?: unknown, invite?: string) => fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', ...(invite ? { 'X-Invite-Token': invite } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let plan!: OwnerPlan;
  async function action(path: string, body: Record<string, unknown>, method = 'POST') { const r = await call(owned + path, undefined, method, body); assert.equal(r.status, 200); plan = planOwnerSchema.parse(await r.json()); return plan; }
  const refresh = async () => { plan = planOwnerSchema.parse(await (await call(owned)).json()); return plan; };
  let details!: PlanDetails, sharedToken = token(); const edit = token(), secondEdit = token(), sid = requestId();
  await t.test('explicit owned option selection is proposed, idempotent and cannot select a foreign/unpublished option', async () => {
    assert.equal((await call(owned, 'synthetic-other-bearer')).status, 404); assert.equal((await call(owned, '')).status, 401);
    const selection = { requestId: requestId(), revision: 0, sessionRevision: 1, ballotId: published.ballot.id, optionId: option.id };
    assert.equal((await call(owned + '/select', 'synthetic-other-bearer', 'POST', selection)).status, 404);
    assert.equal((await call(owned + '/select', undefined, 'POST', { ...selection, optionId: requestId() })).status, 400);
    await action('/select', selection); assert.equal(plan.status, 'proposed'); assert.equal(plan.published, null);
    const revision = plan.revision; await action('/select', selection); assert.equal(plan.revision, revision);
    const invalidPublish = await call(owned + '/publish', undefined, 'POST', { requestId: requestId(), revision: plan.revision, approved: true, previewKey: plan.draftKey, notice: 'Synthetic plan publication' }); assert.equal(invalidPublish.status, 400);
    assert.equal((await call(owned + '/link', undefined, 'POST', { requestId: requestId(), revision: plan.revision, token: sharedToken, days: 14, replace: false })).status, 400);
  });
  await t.test('required local date/time/meeting point and exact-preview key protect confirmed publication; public payload redacts planning data', async () => {
    details = { ...plan.draft.details, date: '2026-11-21', time: '15:00', timeZone: 'America/New_York', meetingPoint: 'Synthetic park north gate', instructions: 'Meet beside the public gate.', booking: 'needs-booking' };
    const save = { requestId: requestId(), revision: plan.revision, details }; await action('/draft', save, 'PUT'); const previous = plan.revision; await action('/draft', save, 'PUT'); assert.equal(plan.revision, previous);
    assert.equal((await call(owned + '/publish', undefined, 'POST', { requestId: requestId(), revision: plan.revision, approved: true, previewKey: '0'.repeat(64), notice: 'Wrong preview must fail' })).status, 409);
    const input = { requestId: requestId(), revision: plan.revision, approved: true, previewKey: plan.draftKey, notice: 'The group agreed; booking still needs checking.' }; await action('/publish', input); assert.equal(plan.status, 'confirmed'); assert.equal(plan.published!.version, 1); await action('/publish', input); assert.equal(plan.published!.version, 1);
    const link = { requestId: requestId(), revision: plan.revision, token: sharedToken, days: 14, replace: false }; const first = await call(owned + '/link', undefined, 'POST', link); assert.equal(first.status, 200); plan = planOwnerSchema.parse((await first.json() as { plan: unknown }).plan);
    assert.equal((await call(owned + '/link', undefined, 'POST', link)).status, 200); assert.equal(await db.planLink.count({ where: { planId: plan.id } }), 1);
    const page = await call('/plan/page', sharedToken); assert.equal(page.status, 200); assert.equal(page.headers.get('cache-control'), 'no-store, private'); const text = await page.text(); const parsed = publicPlanSchema.parse(JSON.parse(text)); assert.equal(parsed.details.booking, 'needs-booking');
    for (const hidden of ['PRIVATE', '17.31', 'tokenDigest', 'sessionId', 'attendance', 'counts', 'draftKey', 'ballotId']) assert.ok(!text.includes(hidden), hidden);
    assert.equal(await (await call('/plan/rsvp', voteEdit, 'GET', undefined, sharedToken)).json(), null, 'a vote does not become an RSVP');
  });
  await t.test('credential-scoped named RSVPs, duplicate sends and edit retries are safe; matching names and wrong credentials grant no access', async () => {
    tick(); const payload = { alias: 'Sam', choice: 'going' as const, planVersion: 1, approved: true as const }, create = { submissionId: sid, editToken: edit, payload };
    const both = await Promise.all([call('/plan/rsvps', sharedToken, 'POST', create), call('/plan/rsvps', sharedToken, 'POST', create)]); assert.deepEqual(both.map(r => r.status), [200, 200]); await refresh(); assert.equal(plan.counts.going, 1); assert.equal(plan.counts.totalResponses, 1);
    assert.equal((await call('/plan/rsvps', sharedToken, 'POST', { ...create, editToken: token() })).status, 404);
    assert.equal((await call('/plan/rsvps', sharedToken, 'POST', { ...create, submissionId: requestId(), editToken: sharedToken })).status, 400);
    const update = { requestId: requestId(), revision: 1, payload: { ...payload, choice: 'maybe' } };
    assert.equal((await call('/plan/rsvp', token(), 'PUT', update, sharedToken)).status, 404);
    assert.equal((await call('/plan/rsvp', edit, 'PUT', update, sharedToken)).status, 200); assert.equal((await call('/plan/rsvp', edit, 'PUT', update, sharedToken)).status, 200);
    assert.equal((await call('/plan/rsvp', edit, 'PUT', { ...update, requestId: requestId() }, sharedToken)).status, 409);
    assert.equal((await call('/plan/rsvps', sharedToken, 'POST', { submissionId: requestId(), editToken: secondEdit, payload })).status, 200); await refresh(); assert.equal(plan.counts.totalResponses, 2); assert.deepEqual(plan.attendance.map(r => r.alias), ['Sam', 'Sam']);
    const mine = ownRsvpSchema.parse(await (await call('/plan/rsvp', edit, 'GET', undefined, sharedToken)).json()); assert.equal(mine.choice, 'maybe'); assert.ok(!('id' in mine)); assert.equal((await call('/plan/attendance', sharedToken)).status, 404);
  });
  await t.test('unpublished draft edits do not alter the shared page; changed time invalidates old RSVPs, stale submissions fail and reconfirmation updates counts', async () => {
    tick(); const oldHash = plan.draftKey; details = { ...details, time: '16:00' }; await action('/draft', { requestId: requestId(), revision: plan.revision, details }, 'PUT');
    assert.equal(publicPlanSchema.parse(await (await call('/plan/page', sharedToken)).json()).details.time, '15:00');
    assert.equal((await call(owned + '/publish', undefined, 'POST', { requestId: requestId(), revision: plan.revision, approved: true, previewKey: oldHash, notice: 'Stale preview must not publish' })).status, 409);
    await action('/publish', { requestId: requestId(), revision: plan.revision, approved: true, previewKey: plan.draftKey, notice: 'The meeting time moved one hour later.' });
    assert.equal(plan.published!.version, 2); assert.equal(plan.counts.needsReconfirmation, 2); assert.equal(plan.counts.going, 0); assert.equal(plan.counts.maybe, 0);
    const page = publicPlanSchema.parse(await (await call('/plan/page', sharedToken)).json()); assert.equal(page.details.time, '16:00'); assert.ok(page.changeNotice.includes('Reconfirm'));
    const stale = { requestId: requestId(), revision: 2, payload: { alias: 'Sam', choice: 'going', planVersion: 1, approved: true } }; assert.equal((await call('/plan/rsvp', edit, 'PUT', stale, sharedToken)).status, 409);
    const current = { ...stale, requestId: requestId(), payload: { ...stale.payload, planVersion: 2 } }; assert.equal((await call('/plan/rsvp', edit, 'PUT', current, sharedToken)).status, 200); await refresh(); assert.equal(plan.counts.going, 1); assert.equal(plan.counts.needsReconfirmation, 1);
    assert.equal((await ballots.dashboard(owner, session.id)).ballots[0].totalResponses, 1, 'RSVP changes do not change the vote tally');
  });
  await t.test('location changes also require reconfirmation; instructions-only updates preserve material confirmation and optimistic revisions prevent lost edits', async () => {
    tick(); const previousRevision = plan.revision;
    details = { ...details, meetingPoint: 'Synthetic park south gate' }; await action('/draft', { requestId: requestId(), revision: plan.revision, details }, 'PUT');
    assert.equal((await call(owned + '/draft', undefined, 'PUT', { requestId: requestId(), revision: previousRevision, details: { ...details, time: '18:00' } })).status, 409);
    await action('/publish', { requestId: requestId(), revision: plan.revision, approved: true, previewKey: plan.draftKey, notice: 'Meet at the south gate instead.' }); assert.equal(plan.counts.needsReconfirmation, 2);
    let mine = ownRsvpSchema.parse(await (await call('/plan/rsvp', edit, 'GET', undefined, sharedToken)).json()); assert.equal(mine.needsReconfirmation, true);
    assert.equal((await call('/plan/rsvp', edit, 'PUT', { requestId: requestId(), revision: mine.revision, payload: { alias: 'Sam', choice: 'going', planVersion: plan.published!.version, approved: true } }, sharedToken)).status, 200); await refresh(); const material = plan.published!.materialVersion;
    details = { ...details, instructions: 'Bring water. This instruction does not change the meeting.' }; await action('/draft', { requestId: requestId(), revision: plan.revision, details }, 'PUT'); await action('/publish', { requestId: requestId(), revision: plan.revision, approved: true, previewKey: plan.draftKey, notice: 'Added a reminder to bring water.' }); assert.equal(plan.published!.materialVersion, material); assert.equal(plan.counts.going, 1);
    mine = ownRsvpSchema.parse(await (await call('/plan/rsvp', edit, 'GET', undefined, sharedToken)).json()); assert.equal(mine.needsReconfirmation, false);
  });
  await t.test('revoked/expired links deny reads and writes; rotated same-plan links preserve own RSVP scope', async () => {
    tick(); const oldLink = sharedToken; sharedToken = token();
    const r = await call(owned + '/link', undefined, 'POST', { requestId: requestId(), revision: plan.revision, token: sharedToken, days: 1, replace: true }); assert.equal(r.status, 200); plan = planOwnerSchema.parse((await r.json() as { plan: unknown }).plan);
    assert.equal((await call('/plan/page', oldLink)).status, 404); assert.equal((await call('/plan/rsvp', edit, 'GET', undefined, oldLink)).status, 404); assert.equal((await call('/plan/rsvps', oldLink, 'POST', { submissionId: requestId(), editToken: token(), payload: { alias: 'Sam', choice: 'going', planVersion: plan.published!.version, approved: true } })).status, 404);
    assert.equal((await call('/plan/rsvp', edit, 'GET', undefined, sharedToken)).status, 200);
    now += 2 * 86400000; assert.equal((await call('/plan/page', sharedToken)).status, 404); assert.equal((await call('/plan/rsvp', edit, 'PUT', { requestId: requestId(), revision: 4, payload: { alias: 'Sam', choice: 'cant', planVersion: plan.published!.version, approved: true } }, sharedToken)).status, 404);
    const next = token(); const renewed = await call(owned + '/link', undefined, 'POST', { requestId: requestId(), revision: plan.revision, token: next, days: 14, replace: true }); assert.equal(renewed.status, 200); plan = planOwnerSchema.parse((await renewed.json() as { plan: unknown }).plan); sharedToken = next;
  });
  await t.test('a publication racing an RSVP cannot leave a stale response counted as current', async () => {
    tick(); const before = plan.published!.version, raceEdit = token(); details = { ...details, time: '17:00' };
    await action('/draft', { requestId: requestId(), revision: plan.revision, details }, 'PUT');
    const publish = { requestId: requestId(), revision: plan.revision, previewKey: plan.draftKey, approved: true, notice: 'The plan moved later; reconfirm before coming.' };
    const [updated, replied] = await Promise.all([call(owned + '/publish', undefined, 'POST', publish), call('/plan/rsvps', sharedToken, 'POST', { submissionId: requestId(), editToken: raceEdit, payload: { alias: 'Race guest', choice: 'maybe', planVersion: before, approved: true } })]);
    assert.equal(updated.status, 200); assert.ok([200, 409].includes(replied.status)); await refresh();
    assert.equal(plan.counts.going, 0); assert.equal(plan.counts.maybe, 0);
    const own = await (await call('/plan/rsvp', raceEdit, 'GET', undefined, sharedToken)).json();
    if (replied.status === 200) assert.equal(ownRsvpSchema.parse(own).needsReconfirmation, true); else assert.equal(own, null);
  });
  await t.test('explicit RSVP closure/cancellation preserve a current public notice, block writes, and do not leak an unapproved draft', async () => {
    tick(); await action('/control', { requestId: requestId(), revision: plan.revision, action: 'close-rsvps', notice: 'RSVP deadline reached; contact the organizer.' });
    assert.equal(publicPlanSchema.parse(await (await call('/plan/page', sharedToken)).json()).rsvpOpen, false);
    assert.equal((await call('/plan/rsvps', sharedToken, 'POST', { submissionId: requestId(), editToken: token(), payload: { alias: 'Later guest', choice: 'going', planVersion: plan.published!.version, approved: true } })).status, 409);
    const publishedTime = plan.published!.details.time; await action('/draft', { requestId: requestId(), revision: plan.revision, details: { ...details, time: '23:00' } }, 'PUT');
    assert.equal((await call(owned + '/control', 'synthetic-other-bearer', 'POST', { requestId: requestId(), revision: plan.revision, action: 'cancelled', notice: 'Unauthorized cancellation' })).status, 404);
    await action('/control', { requestId: requestId(), revision: plan.revision, action: 'cancelled', notice: 'Cancelled because the group cannot make it.' });
    const cancelled = publicPlanSchema.parse(await (await call('/plan/page', sharedToken)).json()); assert.equal(cancelled.status, 'cancelled'); assert.ok(cancelled.changeNotice.startsWith('CANCELLED')); assert.equal(cancelled.details.time, publishedTime); assert.equal(cancelled.rsvpOpen, false);
    assert.equal((await call('/plan/rsvp', edit, 'PUT', { requestId: requestId(), revision: 4, payload: { alias: 'Sam', choice: 'cant', planVersion: cancelled.version, approved: true } }, sharedToken)).status, 409);
    assert.equal((await call(owned + '/publish', undefined, 'POST', { requestId: requestId(), revision: plan.revision, previewKey: plan.draftKey, approved: true, notice: 'Cannot reopen a cancelled plan' })).status, 409);
  });
  await t.test('another owned session cannot use this ballot or response; completion is terminal and revoked page access is closed', async () => {
    tick(); const otherGroup = await organizer.createGroup(other, { name: 'Another account', aliases: [] }), foreign = await organizer.createSession(other, otherGroup.id, { title: 'Other plan', summaryVersion: 1, origin: 'manual', provenance: [], summary });
    await assert.rejects(plans.select(other, foreign.id, { requestId: requestId(), revision: 0, sessionRevision: 1, ballotId: published.ballot.id, optionId: option.id }));
    await action('/revoke', { requestId: requestId(), revision: plan.revision }); assert.equal((await call('/plan/page', sharedToken)).status, 404);
    // A separate proposal exercises confirmed → completed, rather than
    // reopening the cancelled plan or conflating attendance with completion.
    const another = await organizer.createSession(owner, group.id, { title: 'Synthetic completed outing', summaryVersion: 1, origin: 'manual', provenance: [], summary });
    await ballots.save(owner, another.id, { content, revision: 0, sessionRevision: 1 }); const b = await ballots.publish(owner, another.id, { publicationId: requestId(), inviteToken: token(), expectedBallotId: null, shortlistRevision: 1, sessionRevision: 1, approved: true, days: 7 });
    let p = (await plans.select(owner, another.id, { requestId: requestId(), revision: 0, sessionRevision: 1, ballotId: b.ballot.id, optionId: option.id }))!;
    p = (await plans.save(owner, another.id, { requestId: requestId(), revision: p.revision, details }))!; p = (await plans.publish(owner, another.id, { requestId: requestId(), revision: p.revision, previewKey: p.draftKey, approved: true, notice: 'Synthetic confirmed outing' }))!;
    // Reserve closure/terminal status slots even when publication history is full.
    const snapshot = await db.planVersion.findUniqueOrThrow({ where: { planId_version: { planId: p.id, version: 1 } } });
    await db.planVersion.create({ data: { planId: p.id, version: 98, materialVersion: 1, snapshot: snapshot.snapshot!, status: 'confirmed', changeNotice: 'Synthetic limit boundary' } });
    await db.sharedPlan.update({ where: { id: p.id }, data: { publishedVersion: 98 } });
    await assert.rejects(plans.publish(owner, another.id, { requestId: requestId(), revision: p.revision, previewKey: p.draftKey, approved: true, notice: 'Limit should reserve terminal slots' }));
    p = (await plans.control(owner, another.id, { requestId: requestId(), revision: p.revision, action: 'close-rsvps', notice: 'Close before completing this synthetic plan.' }))!;
    p = (await plans.control(owner, another.id, { requestId: requestId(), revision: p.revision, action: 'completed', notice: 'The organizer marked the outing completed.' }))!; assert.equal(p.status, 'completed'); assert.equal(p.published!.version, 100); assert.equal(p.published!.rsvpOpen, false);
    await assert.rejects(plans.save(owner, another.id, { requestId: requestId(), revision: p.revision, details }));
    await organizer.deleteGroup(other, otherGroup.id);
  });
  await t.test('RLS/direct role denial and cascade deletion protect plan snapshots, links and RSVP records', async () => {
    const rows = await db.$queryRaw<{ relrowsecurity: boolean }[]>`SELECT relrowsecurity FROM pg_class WHERE relname IN ('fuzl_shared_plans','fuzl_plan_versions','fuzl_plan_links','fuzl_plan_rsvps')`; assert.equal(rows.length, 4); assert.ok(rows.every(r => r.relrowsecurity));
    await assert.rejects(db.$transaction(async tx => { await tx.$executeRawUnsafe('SET LOCAL ROLE anon'); await tx.$queryRawUnsafe('SELECT * FROM fuzl.fuzl_plan_rsvps'); }));
    await organizer.deleteGroup(owner, group.id); assert.equal(await db.sharedPlan.count({ where: { sessionId: session.id } }), 0); assert.equal(await db.planRsvp.count({ where: { planId: plan.id } }), 0); assert.equal((await call(owned)).status, 404);
  });
});
