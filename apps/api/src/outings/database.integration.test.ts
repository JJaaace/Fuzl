import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { OrganizerStore } from '../accounts/store.js';
import { BallotStore } from '../ballots/store.js';
import { PlanStore } from '../plans/store.js';
import { OutingStore } from './store.js';
import { PlaceStore } from '../places/store.js';
import { createApp } from '../app.js';
import { demoPlaces, demoPlaceQuery, demoPlaceSummary, evaluatePlaces, rankDiscovery, shortlistPlace, outingOwnerSchema, ownFeedbackSchema, publicOutingSchema } from '@fuzl/planning';
const enabled = process.env.FUZL_DISPOSABLE_DATABASE === 'owned-by-test-runner' && !!process.env.FUZL_TEST_DATABASE_URL;
const id = () => randomUUID(), token = () => randomBytes(32).toString('base64url');
test('Section 9 real disposable outing → own feedback → approved same-group memory → edit/remove', { skip: !enabled }, async t => {
  const url = process.env.FUZL_TEST_DATABASE_URL!; assert.equal(new URL(url).hostname, '127.0.0.1');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: 'fuzl' }), log: [] }); t.after(() => db.$disconnect());
  let now = Date.parse('2026-11-14T20:00:00Z'); const tick = () => { now += 61000; };
  const owner = id(), other = id(), organizer = new OrganizerStore(db), ballots = new BallotStore(db, () => now), plans = new PlanStore(db, () => now), outings = new OutingStore(db, () => now), search = new PlaceStore(db);
  const server = createApp({ outings: { store: () => outings, now: () => now }, plans: { store: () => plans, now: () => now }, accounts: { verify: async v => v === 'synthetic-owner-bearer' ? owner : other, places: { store: () => search, now: () => now } } }).listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`;
  const call = (path: string, auth: string, method = 'GET', body?: unknown, invite?: string) => fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', ...(invite ? { 'X-Invite-Token': invite } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const group = await organizer.createGroup(owner, { name: 'Synthetic first group', aliases: [] }), otherGroup = await organizer.createGroup(owner, { name: 'Synthetic second group', aliases: [] });
  const summary = demoPlaceSummary(), payload = { title: 'Synthetic outing', summaryVersion: 1 as const, origin: 'manual' as const, provenance: [], summary };
  const session = await organizer.createSession(owner, group.id, payload), next = await organizer.createSession(owner, group.id, payload), different = await organizer.createSession(owner, otherGroup.id, payload);
  const f = demoPlaces(demoPlaceQuery, new Date(now).toISOString()); assert.ok('area' in f); const checked = evaluatePlaces(f.candidates, f.area, demoPlaceQuery, summary), option = shortlistPlace(checked.verified[0], id());
  async function prepare(sessionId: string) {
    await ballots.save(owner, sessionId, { revision: 0, sessionRevision: 1, content: { title: 'Sample vote', options: [option] } }); const ballotToken = token(); const b = await ballots.publish(owner, sessionId, { publicationId: id(), inviteToken: ballotToken, expectedBallotId: null, shortlistRevision: 1, sessionRevision: 1, approved: true, days: 14 });
    await ballots.submit(ballotToken, { submissionId: id(), editToken: token(), optionId: option.id });
    let p = (await plans.select(owner, sessionId, { requestId: id(), revision: 0, sessionRevision: 1, ballotId: b.ballot.id, optionId: option.id }))!;
    p = (await plans.save(owner, sessionId, { requestId: id(), revision: p.revision, details: { ...p.draft.details, date: '2026-11-07', time: '15:00', timeZone: 'America/New_York', meetingPoint: 'Original synthetic gate' } }))!;
    p = (await plans.publish(owner, sessionId, { requestId: id(), revision: p.revision, approved: true, previewKey: p.draftKey, notice: 'The group agreed to this synthetic plan.' }))!;
    const invite = token(); await plans.link(owner, sessionId, { requestId: id(), revision: p.revision, token: invite, replace: false, days: 14 });
    return { plan: (await plans.get(owner, sessionId))!, invite };
  }
  const setup = await prepare(session.id), edit = token(); let shared = setup.invite, plan = setup.plan;
  const rsvp = await plans.submit(shared, { submissionId: id(), editToken: edit, payload: { alias: 'Sam', choice: 'going', planVersion: plan.published!.version, approved: true } }); assert.equal(rsvp.choice, 'going');
  const actual = { activity: option.name, date: '2026-11-07', time: '16:00', timeZone: 'America/New_York', meetingPoint: 'Actual synthetic south gate' };
  let outing!: NonNullable<Awaited<ReturnType<typeof outings.get>>>;
  const complete = { requestId: id(), revision: plan.revision, actual, sameListing: true, confirmedAttendees: [], approved: true as const };
  const refresh = async () => { outing = (await outings.get(owner, session.id))!; return outing; };
  const approve = async (text: string | null, action: 'approve' | 'remove' | 'notes' = text ? 'approve' : 'remove') => { outing = (await outings.memory(owner, session.id, { requestId: id(), revision: outing.revision, feedbackVersion: outing.feedbackVersion, privateNotes: 'PRIVATE organizer note', proposedTakeaway: 'PRIVATE proposed observation', approvedTakeaway: text, action, approved: true }))!; };
  const answers = { alias: 'Sam', attended: true, again: 'yes' as const, worth: null, note: 'PRIVATE feedback note: parking difficult', allowMemory: true };
  const context = (sessionId = next.id, revision = 1) => search.context(owner, sessionId, { summary, sessionRevision: revision });
  await t.test('confirmed completion records actual corrections separately; retries are safe and RSVP Going is not actual attendance', async () => {
    assert.deepEqual(await outings.past(owner, group.id), []);
    assert.equal((await call(`/private/sessions/${session.id}/outings/complete`, 'synthetic-other-bearer', 'POST', complete)).status, 404);
    const r = await call(`/private/sessions/${session.id}/outings/complete`, 'synthetic-owner-bearer', 'POST', complete); assert.equal(r.status, 200); outing = outingOwnerSchema.parse(await r.json());
    assert.equal(outing.original.details.time, '15:00'); assert.equal(outing.actual.time, '16:00'); assert.equal(outing.original.details.meetingPoint, 'Original synthetic gate'); assert.deepEqual(outing.confirmedAttendees, []); assert.deepEqual(outing.feedback, []);
    await outings.complete(owner, session.id, complete); assert.equal(await db.outing.count({ where: { planId: plan.id } }), 1); assert.equal((await outings.past(owner, group.id)).length, 1);
    assert.equal((await plans.page(shared)).status, 'completed'); assert.equal((await context()).memories?.length, 0);
  });
  await t.test('10.3 actual visits without approved feedback are matched only in their own saved group; RSVP/vote records confer no favorite', async () => {
    const own = await context(), other = await context(different.id);
    assert.ok(own.visitHistory?.sourceUrls.includes(f.candidates[0].sourceUrl!));
    assert.deepEqual(other.visitHistory, { sourceUrls: [], uncertain: false });
    const checked = evaluatePlaces(f.candidates, f.area, demoPlaceQuery, summary, [], own.memories, own.visitHistory);
    assert.equal(checked.ranked![0].discovery?.visit, 'recorded'); assert.equal(checked.ranked![0].discovery?.favorite, false);
    assert.ok(rankDiscovery(checked.ranked!, 'familiar').notice.includes('Too little matched group history'));
  });
  let submission!: { submissionId: string; editToken: string; payload: { outingRevision: number; answers: typeof answers } };
  await t.test('guest sees actual approved fields and own response only; duplicate sends, edits and same-name credentials are scoped', async () => {
    tick(); const pageResponse = await call('/plan/outing', shared), page = publicOutingSchema.parse(await pageResponse.json()); assert.equal(page.actual.meetingPoint, actual.meetingPoint); assert.ok(!JSON.stringify(page).includes('original'));
    submission = { submissionId: id(), editToken: edit, payload: { outingRevision: page.revision, answers } };
    const both = await Promise.all([call('/plan/feedbacks', shared, 'POST', submission), call('/plan/feedbacks', shared, 'POST', submission)]); assert.deepEqual(both.map(r => r.status), [200, 200]);
    const saved = ownFeedbackSchema.parse(await both[0].json()); assert.equal(saved.answers.attended, true); assert.equal(saved.revision, 1); assert.ok(!('id' in saved)); await refresh(); assert.equal(outing.feedback.length, 1);
    assert.equal(await (await call('/plan/feedback', token(), 'GET', undefined, shared)).json(), null, 'same name supplies no authority');
    assert.equal((await call('/plan/feedbacks', shared, 'POST', { ...submission, editToken: token() })).status, 404);
    assert.equal((await call('/plan/feedbacks', shared, 'POST', { ...submission, submissionId: id(), editToken: shared })).status, 400);
    assert.equal((await call('/plan/feedback', token(), 'PUT', { requestId: id(), revision: 1, payload: submission.payload }, shared)).status, 404);
    assert.equal((await call('/plan/feedback/attendance', shared)).status, 404);
    assert.ok(!JSON.stringify((await context()).memories).includes('PRIVATE')); assert.equal((await context()).memories?.length, 0, 'unapproved responses are not memory');
  });
  await t.test('approved memory affects only same-group next recommendations; private notes, individuals and budgets are absent from card responses', async () => {
    await refresh(); await approve('One attendee would return. Parking was difficult.'); assert.equal(outing.memoryActive, true);
    const first = await context(), second = await context(different.id); assert.equal(first.memories?.length, 1); assert.equal(second.memories?.length, 0);
    const r = await call(`/private/sessions/${next.id}/places/search`, 'synthetic-owner-bearer', 'POST', { mode: 'demo', sessionRevision: 1, summary, query: demoPlaceQuery, manual: [] }); assert.equal(r.status, 200); const text = await r.text(); assert.ok(text.includes('Approved group takeaway')); for (const word of ['PRIVATE', 'Sam', 'editDigest']) assert.ok(!text.includes(word));
    const judged = evaluatePlaces(f.candidates, f.area, demoPlaceQuery, summary, [], first.memories, first.visitHistory); assert.equal(judged.verified[0].memory?.boost, 2); assert.equal(judged.verified[0].discovery?.favorite, true);
    const costly = { ...f.candidates[0], price: { ...f.candidates[0].price, amount: 999 } }; assert.equal(evaluatePlaces([costly], f.area, demoPlaceQuery, summary, [], first.memories).excluded.length, 1);
    assert.equal(evaluatePlaces([f.candidates[0]], f.area, { ...demoPlaceQuery, start: '23:00', end: '23:30' }, summary, [], first.memories).verified.length, 0);
  });
  await t.test('new or changed feedback suspends approval; mixed responses stay mixed, idempotent retries do not double count and consent withdrawal takes effect', async () => {
    tick(); const revision = outing.revision, previous = await context(); const edit2 = token(); await outings.feedback(shared, edit2, { submissionId: id(), editToken: edit2, payload: { outingRevision: 1, answers: { ...answers, again: 'no' } } });
    await refresh(); assert.equal(outing.memoryActive, false); assert.equal((await context()).memories?.length, 0); assert.notEqual((await context()).version, previous.version);
    await assert.rejects(outings.memory(owner, session.id, { requestId: id(), revision, feedbackVersion: 1, privateNotes: '', proposedTakeaway: '', approvedTakeaway: 'Stale approval must fail', action: 'approve', approved: true }));
    await approve('Attendees disagreed about repeating. Parking was difficult.'); assert.equal((await context()).memories![0].sentiment, 'mixed');
    const mine = (await outings.readOwn(shared, edit))!, update = { requestId: id(), revision: mine.revision, payload: { outingRevision: 1, answers: { ...answers, allowMemory: false } } };
    await outings.feedback(shared, edit, update); const after = (await outings.readOwn(shared, edit))!.revision; await outings.feedback(shared, edit, update); assert.equal((await outings.readOwn(shared, edit))!.revision, after); await assert.rejects(outings.feedback(shared, edit, { ...update, payload: { ...update.payload, answers } }));
    await refresh(); assert.equal(outing.memoryActive, false); await approve('The permitted repeat rating was negative.'); assert.equal((await context()).memories![0].sentiment, 'negative');
  });
  await t.test('memory edits/removal affect future searches immediately; corrections preserve original and require fresh feedback review', async () => {
    const before = (await context()).version; await approve('Revised permitted group observation.'); assert.notEqual((await context()).version, before); assert.equal((await context()).memories![0].takeaway, 'Revised permitted group observation.');
    await approve(null); assert.equal((await context()).memories?.length, 0);
    const correction = { requestId: id(), revision: outing.revision, actual: { ...actual, meetingPoint: 'Different actual cafe' }, sameListing: false, confirmedAttendees: ['Organizer explicitly confirms Pat'] };
    outing = (await outings.editActual(owner, session.id, correction))!; assert.equal(outing.original.details.meetingPoint, 'Original synthetic gate'); assert.deepEqual(outing.confirmedAttendees, ['Organizer explicitly confirms Pat']); assert.ok(outing.feedback.every(f => f.needsReview));
    await approve('We changed venues.'); assert.equal((await context()).memories![0].sourceUrl, null, 'no boost transferred to unvisited source'); assert.equal((await context()).memories![0].sentiment, 'unrated');
    assert.equal((await call('/plan/feedback', edit, 'PUT', { requestId: id(), revision: 2, payload: submission.payload }, shared)).status, 409, 'stale actual outing cannot be answered');
  });
  await t.test('10.3 corrected actual venues without an explicit match suspend novelty claims; future search returns only minimal history labels', async () => {
    const current = await context(); assert.equal(current.visitHistory?.uncertain, true);
    assert.ok(!current.visitHistory?.sourceUrls.includes(f.candidates[0].sourceUrl!));
    const judged = evaluatePlaces(f.candidates, f.area, demoPlaceQuery, summary, [], current.memories, current.visitHistory);
    assert.ok(judged.ranked!.every(row => row.discovery?.visit === 'unknown' && !row.discovery.favorite));
    assert.equal(rankDiscovery(judged.ranked!, 'new').changed, false);
    assert.ok(!JSON.stringify(judged).includes('PRIVATE')); assert.ok(!JSON.stringify(judged).includes('confirmedAttendees'));
  });
  await t.test('moving a saved session does not move an outing memory to another group', async () => {
    await organizer.updateSession(owner, session.id, otherGroup.id, 1, payload);
    assert.equal((await outings.past(owner, group.id)).length, 1); assert.equal((await outings.past(owner, otherGroup.id)).length, 0); assert.equal((await context(different.id)).memories?.length, 0);
  });
  await t.test('approval racing a feedback change never keeps obsolete approved sentiment active; foreign-plan edit credentials have no response authority', async () => {
    const mine = (await outings.readOwn(shared, edit))!; await refresh();
    const approval = { requestId: id(), revision: outing.revision, feedbackVersion: outing.feedbackVersion, privateNotes: '', proposedTakeaway: '', approvedTakeaway: 'Review this correction before future use.', action: 'approve' as const, approved: true as const };
    const changedFeedback = { requestId: id(), revision: mine.revision, payload: { outingRevision: 2, answers: { ...answers, again: 'no' as const } } };
    const outcomes = await Promise.allSettled([outings.memory(owner, session.id, approval), outings.feedback(shared, edit, changedFeedback)]);
    assert.equal(outcomes[1].status, 'fulfilled'); await refresh(); assert.equal(outing.memoryActive, false); assert.equal((await context()).memories?.length, 0);
    const foreignSession = await organizer.createSession(owner, otherGroup.id, payload), foreign = await prepare(foreignSession.id);
    await outings.complete(owner, foreignSession.id, { ...complete, requestId: id(), revision: foreign.plan.revision });
    assert.equal(await outings.readOwn(foreign.invite, edit), null);
    await assert.rejects(outings.feedback(foreign.invite, edit, { ...changedFeedback, requestId: id(), payload: { ...changedFeedback.payload, outingRevision: 1 } }));
    await organizer.deleteSession(owner, foreignSession.id);
  });
  await t.test('proposed, future and cancelled plans cannot become visits; other owners cannot read/update group history', async () => {
    const cancelledSession = await organizer.createSession(owner, group.id, payload), cancelled = await prepare(cancelledSession.id);
    await assert.rejects(outings.complete(owner, cancelledSession.id, { ...complete, requestId: id(), revision: cancelled.plan.revision, actual: { ...actual, date: '2099-01-01' } }));
    const c = (await plans.control(owner, cancelledSession.id, { requestId: id(), revision: cancelled.plan.revision, action: 'cancelled', notice: 'Synthetic cancellation; no outing occurred.' }))!;
    await assert.rejects(outings.complete(owner, cancelledSession.id, { ...complete, requestId: id(), revision: c.revision })); assert.equal((await outings.past(owner, group.id)).length, 1);
    await assert.rejects(outings.get(other, session.id)); await assert.rejects(outings.past(other, group.id)); await assert.rejects(outings.memory(other, session.id, { requestId: id(), revision: outing.revision, feedbackVersion: outing.feedbackVersion, privateNotes: '', proposedTakeaway: '', approvedTakeaway: null, action: 'remove', approved: true }));
  });
  await t.test('revoked, expired and wrong-plan guest permissions deny feedback reads/writes; closure of RSVPs never invents attendance', async () => {
    tick(); plan = (await plans.get(owner, session.id))!; assert.equal(plan.published!.rsvpOpen, false);
    await plans.revoke(owner, session.id, { requestId: id(), revision: plan.revision }); assert.equal((await call('/plan/outing', shared)).status, 404); assert.equal((await call('/plan/feedback', edit, 'GET', undefined, shared)).status, 404); await assert.rejects(outings.feedback(shared, edit, { requestId: id(), revision: 2, payload: submission.payload }));
    plan = (await plans.get(owner, session.id))!; shared = token(); await plans.link(owner, session.id, { requestId: id(), revision: plan.revision, token: shared, days: 1, replace: true }); now += 2 * 86400000;
    assert.equal((await call('/plan/outing', shared)).status, 404); await assert.rejects(outings.readOwn(shared, edit));
  });
  await t.test('RLS and cascading deletion protect feedback/memories without touching unrelated data', async () => {
    const rows = await db.$queryRaw<{ relrowsecurity: boolean }[]>`SELECT relrowsecurity FROM pg_class WHERE relname IN ('fuzl_outings','fuzl_outing_feedback')`; assert.equal(rows.length, 2); assert.ok(rows.every(r => r.relrowsecurity));
    await assert.rejects(db.$transaction(async tx => { await tx.$executeRawUnsafe('SET LOCAL ROLE anon'); await tx.$queryRawUnsafe('SELECT * FROM fuzl.fuzl_outing_feedback'); }));
    await organizer.deleteGroup(owner, group.id); assert.equal(await db.outing.count({ where: { id: outing.id } }), 0); assert.equal(await db.outingFeedback.count({ where: { outingId: outing.id } }), 0); assert.equal((await context(different.id)).memories?.length, 0); await organizer.deleteGroup(owner, otherGroup.id);
  });
});
