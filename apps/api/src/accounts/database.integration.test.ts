import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { OrganizerStore } from './store.js';
import { createApp } from '../app.js';
import { ExtractionError } from '../extraction/errors.js';
import { evaluationCases } from '../extraction/cases.js';
import { validateExtraction } from '../extraction/validate.js';
import { blankFact, sessionInputSchema, supportingSummary } from '@fuzl/planning';
import type { SessionInput, SavedSession } from '@fuzl/planning';
const enabled = process.env.FUZL_DISPOSABLE_DATABASE === 'owned-by-test-runner' && !!process.env.FUZL_TEST_DATABASE_URL;
test('actual migrated PostgreSQL: private endpoints, two-account ownership, fidelity, immutable quotes, revisions and cascade deletion', { skip: !enabled }, async (t) => {
  const url = process.env.FUZL_TEST_DATABASE_URL!;
  assert.equal(new URL(url).hostname, '127.0.0.1');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: 'fuzl' }), log: [] });
  t.after(() => db.$disconnect());
  const store = new OrganizerStore(db);
  const a = '11111111-1111-4111-8111-111111111111'; const b = '22222222-2222-4222-8222-222222222222';
  const tokenA = 'a-controlled-test-token-long'; const tokenB = 'b-controlled-test-token-long';
  const app = createApp({ accounts: { store: () => store, verify: async (token) => {
    if (token === tokenA) return a; if (token === tokenB) return b;
    throw new ExtractionError(401, 'session_expired', 'Sign in again.');
  } } });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/private`;
  const call = (path: string, token = tokenA, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => fetch(origin + path, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  await t.test('migration preserves unrelated data already present in the database', async () => {
    const existing = await db.$queryRaw<{ id: number }[]>`SELECT id FROM public.unrelated_existing_data`;
    assert.deepEqual(existing, [{ id: 1 }]);
  });
  await t.test('requires verification and rejects foreign origins/client owner IDs', async () => {
    assert.equal((await fetch(origin + '/groups')).status, 401);
    assert.equal((await call('/groups', 'invalid-controlled-token')).status, 401);
    assert.equal((await call('/groups', tokenA, 'GET', undefined, { Origin: 'https://attacker.example' })).status, 403);
    assert.equal((await call('/groups', tokenA, 'POST', { name: 'Bad owner', aliases: [], ownerId: b })).status, 400);
  });
  const ga = await store.createGroup(a, { name: 'A friends', aliases: ['Alex', 'Sam'] });
  const gb = await store.createGroup(b, { name: 'B friends', aliases: ['Alex'] });
  const first = evaluationCases[1];
  const summary = supportingSummary(validateExtraction(first.authoredOutput, first.request).summary);
  const input: SessionInput = { title: 'Synthetic zero', origin: 'ai', summaryVersion: 1, summary, provenance: [] };
  const sa = await store.createSession(a, ga.id, input); const sb = await store.createSession(b, gb.id, { ...input, title: 'B private' });
  await t.test('A cannot read, edit, delete, list, create under or assign into B records', async () => {
    const groups = await (await call('/groups')).json() as { id: string }[]; assert.deepEqual(groups.map((group) => group.id), [ga.id]);
    for (const [path, method, body] of [
      [`/groups/${gb.id}/sessions`, 'GET', undefined], [`/sessions/${sb.id}`, 'GET', undefined],
      [`/groups/${gb.id}`, 'PUT', { name: 'stolen', aliases: [], revision: gb.revision }], [`/groups/${gb.id}`, 'DELETE', undefined],
      [`/sessions/${sb.id}`, 'PUT', { payload: input, groupId: ga.id, revision: sb.revision }], [`/sessions/${sb.id}`, 'DELETE', undefined],
      [`/groups/${gb.id}/sessions`, 'POST', input], [`/sessions/${sa.id}`, 'PUT', { payload: input, groupId: gb.id, revision: sa.revision }],
    ] as const) assert.equal((await call(path, tokenA, method, body)).status, 404, `${method} ${path}`);
    assert.equal((await store.getSession(b, sb.id)).title, 'B private');
  });
  await t.test('save → independent client read preserves every existing synthetic summary field', async () => {
    for (const item of evaluationCases) {
      const candidate = supportingSummary(validateExtraction(item.authoredOutput, item.request).summary);
      const response = await call(`/groups/${ga.id}/sessions`, tokenA, 'POST', { ...input, title: item.id, summary: candidate });
      assert.equal(response.status, 201); const saved = await response.json() as SavedSession;
      const separate = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: 'fuzl' }), log: [] });
      try { assert.deepEqual((await new OrganizerStore(separate).getSession(a, saved.id)).payload.summary, candidate); } finally { await separate.$disconnect(); }
    }
    const manual = { ...blankFact('budget', 'manual'), amount: null, currency: null };
    const payload = sessionInputSchema.parse({ ...input, origin: 'manual', summary: { participants: [], speakers: [], sources: [], questions: [], facts: [manual] } });
    const saved = await store.createSession(a, ga.id, payload); assert.deepEqual((await store.getSession(a, saved.id)).payload, payload);
  });
  await t.test('corrections preserve original quotes and concurrent stale revisions cannot overwrite', async () => {
    const edited = structuredClone(input); edited.summary.facts[0].status = 'tentative'; edited.summary.facts[0].extraction!.reviewed = true;
    if (edited.summary.facts[0].kind === 'budget') edited.summary.facts[0].amount = 12.5;
    const updated = await store.updateSession(a, sa.id, ga.id, sa.revision, edited); assert.equal(updated.revision, sa.revision + 1);
    assert.deepEqual(updated.payload.summary.sources, input.summary.sources);
    assert.equal(updated.payload.summary.facts[0].kind === 'budget' && updated.payload.summary.facts[0].amount, 12.5);
    const stale = await call(`/sessions/${sa.id}`, tokenA, 'PUT', { payload: input, groupId: ga.id, revision: sa.revision }); assert.equal(stale.status, 409);
    const poisoned = structuredClone(edited); poisoned.summary.sources[0].text = 'Changed original quote';
    assert.equal((await call(`/sessions/${sa.id}`, tokenA, 'PUT', { payload: poisoned, groupId: ga.id, revision: updated.revision })).status, 422);
    const both = await Promise.all([call(`/sessions/${sa.id}`, tokenA, 'PUT', { payload: edited, groupId: ga.id, revision: updated.revision }), call(`/sessions/${sa.id}`, tokenA, 'PUT', { payload: edited, groupId: ga.id, revision: updated.revision })]);
    assert.deepEqual(both.map((response) => response.status).sort(), [200, 409]);
  });
  await t.test('title/group changes are authorized and source correction provenance round-trips', async () => {
    const other = await store.createGroup(a, { name: 'A second group', aliases: [] }); const current = await store.getSession(a, sa.id);
    const payload = { ...current.payload, title: 'Renamed', provenance: [{ sourceId: current.payload.summary.sources[0].id, entries: [{ screenshotId: 'synthetic-image', originalSpeaker: null, reviewedSpeaker: 'Alex', originalVisibleDateTime: null, reviewedVisibleDateTime: null, originalText: 'Unclear reading', reviewedText: current.payload.summary.sources[0].text, uncertainty: 'Cropped label' }] }] };
    const moved = await store.updateSession(a, sa.id, other.id, current.revision, payload); assert.equal(moved.groupId, other.id); assert.deepEqual(moved.payload, payload);
    const newGroup = await store.updateGroup(a, other.id, { name: 'Renamed group', aliases: ['Corrected alias'], revision: other.revision });
    assert.equal(newGroup.aliases[0].name, 'Corrected alias');
    assert.equal((await call(`/groups/${other.id}`, tokenA, 'PUT', { name: 'Stale', aliases: [], revision: other.revision })).status, 409);
  });
  await t.test('public Supabase roles cannot read app tables; every table has RLS', async () => {
    const rows = await db.$queryRaw<{ relrowsecurity: boolean }[]>`SELECT relrowsecurity FROM pg_class WHERE relname IN ('fuzl_organizers','fuzl_groups','fuzl_aliases','fuzl_sessions')`;
    assert.equal(rows.length, 4); assert.ok(rows.every((row) => row.relrowsecurity));
    const connection = new Client({ connectionString: url }); await connection.connect();
    try { await connection.query('SET ROLE anon'); await assert.rejects(connection.query('SELECT * FROM fuzl.fuzl_sessions'), (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === '42501'); }
    finally { await connection.end(); }
  });
  await t.test('session deletion and group cascades remove owned dependents without touching B', async () => {
    const created = await store.createSession(a, ga.id, input); assert.equal((await call(`/sessions/${created.id}`, tokenA, 'DELETE')).status, 204);
    assert.equal(await db.planningSession.count({ where: { id: created.id } }), 0);
    assert.equal((await call(`/groups/${ga.id}`, tokenA, 'DELETE')).status, 204);
    assert.equal(await db.participantAlias.count({ where: { groupId: ga.id } }), 0); assert.equal(await db.planningSession.count({ where: { groupId: ga.id } }), 0);
    assert.equal((await store.getSession(b, sb.id)).id, sb.id);
    const response = await call(`/sessions/${sb.id}`, tokenB); assert.equal(response.headers.get('cache-control'), 'no-store');
    const loaded = await response.json() as SavedSession; assert.equal(loaded.title, 'B private');
  });
});
