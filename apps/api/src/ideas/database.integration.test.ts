import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { OrganizerStore } from '../accounts/store.js';
import { PlaceStore } from '../places/store.js';
import { IdeaStore } from './store.js';
import { AdjustmentCache, workHash } from '../adjustments/cache.js';
import { createApp } from '../app.js';
import { emptyIdea, ideaSchema, ideaChoicesSchema, demoPlaceSummary, demoPlaceQuery, placeResultsSchema, eventResultsSchema, demoPlaces, demoEvents, listingKey, emptySelection, shortlistPlace } from '@fuzl/planning';
import type { SavedIdea, PlaceResults, WorkCandidates } from '@fuzl/planning';
const enabled = process.env.FUZL_DISPOSABLE_DATABASE === 'owned-by-test-runner' && !!process.env.FUZL_TEST_DATABASE_URL;
const id = () => randomUUID();
test('Section 10.2 disposable saved idea → second session → checked candidate → public snapshot, with group isolation and private-note protection', { skip: !enabled }, async t => {
  const url = process.env.FUZL_TEST_DATABASE_URL!; assert.equal(new URL(url).hostname, '127.0.0.1');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: 'fuzl' }), log: [] }); t.after(() => db.$disconnect());
  const owner = id(), other = id(), organizer = new OrganizerStore(db), store = new IdeaStore(db), context = new PlaceStore(db), cache = new AdjustmentCache();
  const group = await organizer.createGroup(owner, { name: 'Synthetic first group', aliases: [] }), secondGroup = await organizer.createGroup(owner, { name: 'Synthetic second group', aliases: [] }), foreignGroup = await organizer.createGroup(other, { name: 'Synthetic other account', aliases: [] });
  const summary = demoPlaceSummary(), payload = { title: 'Synthetic session', summaryVersion: 1 as const, origin: 'manual' as const, provenance: [], summary };
  const first = await organizer.createSession(owner, group.id, payload), second = await organizer.createSession(owner, group.id, payload), elsewhere = await organizer.createSession(owner, secondGroup.id, payload);
  const server = createApp({ accounts: { verify: async s => s === 'synthetic-owner-bearer' ? owner : other, ideas: { store: () => store }, adjustments: { cache }, places: { store: () => context }, events: { store: () => context } } }).listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/private`, library = `/groups/${group.id}/ideas`;
  const call = (path: string, method = 'GET', body?: unknown, auth = 'synthetic-owner-bearer') => fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const seed = async (c: WorkCandidates, sessionId = first.id) => { const checked = await context.context(owner, sessionId, { summary, sessionRevision: 1 }); return cache.put({ subject: owner, sessionId, revision: 1, contextVersion: checked.version, baselineVersion: checked.baselineVersion, summaryKey: workHash(summary), context: c, mode: 'demo' }); };
  let idea!: SavedIdea, result!: PlaceResults;
  const content = { ...emptyIdea(), name: 'Synthetic night market', link: null, note: 'PRIVATE Sam wants to try this; personal note 17.31', address: 'Synthetic north gate' }, creation = { requestId: id(), content, allowDuplicate: false };
  const search = (refs = [{ id: idea.id, revision: idea.revision }], sessionId = second.id) => call(`/sessions/${sessionId}/places/search`, 'POST', { mode: 'demo', sessionRevision: 1, summary, query: demoPlaceQuery, manual: [], savedIdeas: refs });
  await t.test('name-only/optional-link creation is idempotent, scoped to this group and protected from foreign account/group reads or writes', async () => {
    const both = await Promise.all([call(library, 'POST', creation), call(library, 'POST', creation)]); assert.deepEqual(both.map(r => r.status), [200, 200]); idea = ideaSchema.parse(await both[0].json()); assert.equal(await db.savedIdea.count({ where: { groupId: group.id } }), 1); assert.equal(idea.content.link, null);
    assert.equal((await call(library, 'GET', undefined, 'synthetic-other-bearer')).status, 404);
    assert.equal((await call(`/groups/${foreignGroup.id}/ideas`)).status, 404); assert.deepEqual(await (await call(`/groups/${secondGroup.id}/ideas`)).json(), []);
    assert.equal((await call(`${library}/${idea.id}`, 'PUT', { requestId: id(), revision: 1, content, allowDuplicate: true }, 'synthetic-other-bearer')).status, 404);
    assert.equal((await call(library, 'POST', { ...creation, requestId: id(), content: { ...content, price: 0 } })).status, 400);
  });
  await t.test('second session imports only current-group references; unknown cost/hours/access stay unresolved and notes never enter candidate/ballot JSON', async () => {
    const picks = await call(library + '/candidates'); assert.equal(picks.status, 200); const text = await picks.text(); assert.ok(!text.includes('PRIVATE')); assert.ok(!text.includes('17.31')); assert.equal(ideaChoicesSchema.parse(JSON.parse(text))[0].id, idea.id);
    assert.equal((await search(undefined, elsewhere.id)).status, 404, 'same organizer cannot inject another group’s idea');
    const r = await search(); assert.equal(r.status, 200); const body = await r.text(); assert.ok(!body.includes('PRIVATE')); assert.ok(!body.includes('17.31')); result = placeResultsSchema.parse(JSON.parse(body)); const saved = result.savedIdeaResults![0]; assert.equal(saved.status, 'needs-checking'); assert.equal(saved.candidate.price.amount, null); assert.equal(saved.candidate.sourceUrl, null); assert.equal(saved.candidate.hours.kind, 'unknown'); assert.equal(saved.candidate.visit, undefined);
    const publicOption = shortlistPlace(saved, id()); assert.equal(publicOption.cost.amount, null); assert.deepEqual(publicOption.links, []); assert.ok(!JSON.stringify(publicOption).includes('PRIVATE'));
  });
  await t.test('private-budget checks remain server-side and source corrections use existing validation for the added candidate', async () => {
    const invite = await db.guestInvite.create({ data: { sessionId: second.id, tokenDigest: id().replaceAll('-', '').padEnd(64, 'a'), title: 'Synthetic private question', questions: [], expiresAt: new Date(Date.now() + 86400000) } });
    const response = await db.guestResponse.create({ data: { inviteId: invite.id, submissionId: id(), editDigest: id().replaceAll('-', '').padEnd(64, 'b'), alias: 'PRIVATE respondent', answers: [] } }); await db.guestPrivateAnswer.create({ data: { responseId: response.id, questionId: id(), amount: .17, currency: 'USD', state: 'known' } });
    const fresh = await search(); assert.equal(fresh.status, 200); result = placeResultsSchema.parse(await fresh.json());
    const c = result.savedIdeaResults![0].candidate, source = { kind: 'organizer', url: 'https://example.com/source-check', checkedOn: '2026-11-14', verifiedForVenue: true };
    const correction = { candidateId: c.id, candidateSource: 'organizer', listingKey: listingKey(c), confirmedOn: '2026-11-14', selected: { ...emptySelection(), address: 'checked-address', price: 'checked-price' }, claims: [{ id: 'checked-address', field: 'address', value: { address: c.address, lat: 40.0017, lon: -83.0197, city: 'Columbus', state: 'OH', timeZone: 'America/New_York' }, source }, { id: 'checked-price', field: 'price', value: { amount: 1, currency: 'USD', basis: 'per-person', coverage: 'total' }, addressId: 'checked-address', source }] };
    const r = await call(`/sessions/${second.id}/places/evaluate`, 'POST', { mode: 'demo', sessionRevision: 1, summary, query: demoPlaceQuery, manual: [], savedIdeas: [{ id: idea.id, revision: idea.revision }], searchId: result.searchId, corrections: [correction] }); assert.equal(r.status, 200); const text = await r.text(); const parsed = placeResultsSchema.parse(JSON.parse(text)); assert.ok(!text.includes('0.17')); assert.ok(!text.includes('PRIVATE')); assert.equal(parsed.savedIdeaResults![0].checks.find(c => c.kind === 'private-budget')?.status, 'does-not-fit');
    result = parsed;
  });
  await t.test('edits invalidate stale selected revisions while rechecks can reuse provider baselines; archive/restore and removal protect concurrent writes', async () => {
    const before = await context.context(owner, second.id, { summary, sessionRevision: 1 }), edit = { requestId: id(), revision: idea.revision, content: { ...idea.content, name: 'Edited night market' }, allowDuplicate: false };
    idea = ideaSchema.parse(await (await call(`${library}/${idea.id}`, 'PUT', edit)).json()); const changed = await context.context(owner, second.id, { summary, sessionRevision: 1 }); assert.notEqual(changed.version, before.version); assert.equal(changed.baselineVersion, before.baselineVersion);
    assert.equal((await call(`${library}/${idea.id}`, 'PUT', { ...edit, requestId: id() })).status, 409);
    assert.equal((await search([{ id: idea.id, revision: 1 }])).status, 409);
    const updated = await call(`/sessions/${second.id}/places/evaluate`, 'POST', { mode: 'demo', sessionRevision: 1, summary, query: demoPlaceQuery, manual: [], savedIdeas: [{ id: idea.id, revision: idea.revision }], searchId: result.searchId }); assert.equal(updated.status, 200); assert.equal(placeResultsSchema.parse(await updated.json()).savedIdeaResults![0].candidate.name, 'Edited night market');
    const archive = { requestId: id(), revision: idea.revision, archived: true }; idea = ideaSchema.parse(await (await call(`${library}/${idea.id}/archive`, 'POST', archive)).json()); assert.equal((await call(`${library}/${idea.id}/archive`, 'POST', archive)).status, 200); assert.equal((await search()).status, 409);
    idea = ideaSchema.parse(await (await call(`${library}/${idea.id}/archive`, 'POST', { requestId: id(), revision: idea.revision, archived: false })).json()); assert.equal((await search()).status, 200);
    assert.equal((await call(`${library}/${idea.id}`, 'DELETE', { revision: 1 })).status, 409);
  });
  await t.test('past events stay in the library and out of active picks/search; duplicate links and provider items warn but explicit separate dates are permitted', async () => {
    const pastContent = { ...emptyIdea(), name: 'Past market', kind: 'event', eventDate: '2000-01-01', timeZone: 'America/New_York', link: 'https://example.com/market?utm_source=chat' };
    const past = ideaSchema.parse(await (await call(library, 'POST', { requestId: id(), content: pastContent, allowDuplicate: false })).json()); assert.equal(past.dateState, 'past'); assert.ok(!(await (await call(library + '/candidates')).text()).includes(past.id));
    const eventRequest = { mode: 'demo', sessionRevision: 1, summary, query: { area: demoPlaceQuery.area, radiusKm: 5, from: '2099-01-01', to: '2099-01-01' }, savedIdeas: [{ id: past.id, revision: past.revision }] };
    assert.equal((await call(`/sessions/${first.id}/events/search`, 'POST', eventRequest)).status, 409);
    const repeat = { requestId: id(), content: { ...pastContent, name: 'Different occurrence', eventDate: '2099-01-01', link: 'https://example.com/market' }, allowDuplicate: false }; assert.equal((await call(library, 'POST', repeat)).status, 409); assert.equal((await call(library, 'POST', { ...repeat, requestId: id(), allowDuplicate: true })).status, 200);
  });
  await t.test('Geoapify card save copies permitted stable references only and credits survive; Ticketmaster API display fields are never persisted automatically', async () => {
    const f = demoPlaces(demoPlaceQuery, '2026-11-14T12:00:00Z'); assert.ok('area' in f); const geo = { ...f.candidates[0], source: 'geoapify' as const, id: 'specific-geo-place', sourceUrl: 'https://www.openstreetmap.org/?mlat=40.0017&mlon=-83.0197' };
    const snapshotId = await seed({ kind: 'places', area: f.area, query: demoPlaceQuery, candidates: [geo] });
    const fromCard = { snapshotId, candidateKey: `geoapify:${geo.id}`, sessionRevision: 1, requestId: id(), content: { ...emptyIdea(), name: 'My saved park', note: 'PRIVATE card note' }, allowDuplicate: false };
    const r = await call(`/sessions/${first.id}/ideas/from-card`, 'POST', fromCard); assert.equal(r.status, 200); const saved = ideaSchema.parse(await r.json()); assert.equal(saved.origin.provider, 'geoapify'); assert.equal(saved.origin.itemId, geo.id); assert.equal(saved.content.address, geo.address); assert.equal(saved.content.lastCheckedOn, '2026-11-14'); assert.ok(!('price' in saved.content)); assert.ok(!('hours' in saved.content));
    const imported = await store.resolve(owner, second.id, [{ id: saved.id, revision: saved.revision }], 'places'); assert.equal(imported.places[0].price.amount, null); assert.equal(imported.places[0].hours.kind, 'unknown'); assert.ok(!JSON.stringify(imported).includes('PRIVATE'));
    assert.equal((await call(`/sessions/${first.id}/ideas/from-card`, 'POST', { ...fromCard, sessionRevision: 2 })).status, 409);
    const events = demoEvents({ area: demoPlaceQuery.area, radiusKm: 5, from: '2026-11-14', to: '2026-11-14' }, '2026-11-14T12:00:00Z'); assert.ok('events' in events); const tm = { ...events.events[0], id: 'specific-tm-event', source: 'ticketmaster' as const, title: 'UPSTREAM TITLE NOT TO RETAIN', venue: { ...events.events[0].venue, name: 'UPSTREAM VENUE NOT TO RETAIN' }, sourceUrl: 'https://www.ticketmaster.com/synthetic-specific-event' };
    const tmSnapshot = await seed({ kind: 'events', area: events.area, query: { area: demoPlaceQuery.area, radiusKm: 5, from: '2026-11-14', to: '2026-11-14' }, candidates: [tm] });
    const body = { ...fromCard, snapshotId: tmSnapshot, candidateKey: `ticketmaster:${tm.id}`, requestId: id(), content: { ...emptyIdea(), name: 'My intended gig', kind: 'event', eventDate: '2099-02-01', timeZone: 'America/New_York', note: 'PRIVATE intended outing' } };
    const bookmark = ideaSchema.parse(await (await call(`/sessions/${first.id}/ideas/from-card`, 'POST', body)).json()); const stored = await db.savedIdea.findUniqueOrThrow({ where: { id: bookmark.id } }); assert.ok(!JSON.stringify(stored).includes('UPSTREAM')); assert.equal(bookmark.content.address, null); assert.equal(bookmark.content.start, null); assert.equal(bookmark.content.eventDate, '2099-02-01'); assert.equal(bookmark.origin.itemId, tm.id);
    assert.equal((await call(`/sessions/${first.id}/ideas/from-card`, 'POST', { ...body, requestId: id(), content: { ...body.content, eventDate: '2099-02-02' } })).status, 409); assert.equal((await call(`/sessions/${first.id}/ideas/from-card`, 'POST', { ...body, requestId: id(), allowDuplicate: true, content: { ...body.content, eventDate: '2099-02-02' } })).status, 200);
  });
  await t.test('event candidates use the same private checks and source recheck without provider calls; deletion and RLS isolate stored ideas', async () => {
    const future = await store.create(owner, group.id, { requestId: id(), content: { ...emptyIdea(), name: 'Future manually described event', kind: 'event', eventDate: '2099-01-01', timeZone: 'America/New_York', note: 'PRIVATE event note' }, allowDuplicate: false });
    const r = await call(`/sessions/${first.id}/events/search`, 'POST', { mode: 'demo', sessionRevision: 1, summary, query: { area: demoPlaceQuery.area, radiusKm: 5, from: '2099-01-01', to: '2099-01-01' }, savedIdeas: [{ id: future.id, revision: future.revision }] }); assert.equal(r.status, 200); const text = await r.text(); assert.ok(!text.includes('PRIVATE')); const data = eventResultsSchema.parse(JSON.parse(text)); assert.equal(data.savedIdeaResults![0].event.price.amount, null); assert.equal(data.savedIdeaResults![0].status, 'needs-checking');
    const roles = await db.$queryRaw<{ relrowsecurity: boolean }[]>`SELECT relrowsecurity FROM pg_class WHERE relname = 'fuzl_saved_ideas'`; assert.equal(roles[0].relrowsecurity, true); await assert.rejects(db.$transaction(async tx => { await tx.$executeRawUnsafe('SET LOCAL ROLE anon'); await tx.$queryRawUnsafe('SELECT * FROM fuzl.fuzl_saved_ideas'); }));
    assert.equal((await call(`${library}/${idea.id}`, 'DELETE', { revision: idea.revision })).status, 204); assert.equal((await call(`${library}/${idea.id}`, 'DELETE', { revision: idea.revision })).status, 204); assert.equal((await search()).status, 404);
    await organizer.deleteGroup(owner, group.id); assert.equal(await db.savedIdea.count({ where: { groupId: group.id } }), 0); await organizer.deleteGroup(owner, secondGroup.id); await organizer.deleteGroup(other, foreignGroup.id);
  });
});
