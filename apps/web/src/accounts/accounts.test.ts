import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccountIdentity, WorkspaceEdits, RequestLifetime, privateRequest, SavedWorkError, validateLoadedSession } from './api';
import { supportingSummary } from '@fuzl/planning';
import { examples } from '../planning/examples';
test('account lifetimes and out-of-order responses cannot reappear after sign-out or account switch', () => {
  const a = new RequestLifetime(); const first = a.capture(); const latest = a.capture();
  assert.equal(a.current(first), false); assert.equal(a.current(latest), true);
  a.dispose(); const b = new RequestLifetime(); const next = b.capture();
  assert.equal(a.current(latest), false); assert.equal(b.current(next), true); assert.equal(a.signal.aborted, true);
});
test('private requests use explicit bearer tokens without cookies, preserve failed saves and expose conflicts', async (t) => {
  const payload = { title: 'Pending edit' }; const before = structuredClone(payload);
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/private/sessions/test'); assert.equal(options.credentials, 'omit');
    assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer synthetic-token');
    assert.equal(options.body, JSON.stringify(payload));
    return Response.json({ error: { message: 'This session changed. Your edits were kept.' } }, { status: 409 });
  });
  await assert.rejects(privateRequest('synthetic-token', '/sessions/test', new AbortController().signal, 'PUT', payload), (error: unknown) => error instanceof SavedWorkError && error.status === 409);
  assert.deepEqual(payload, before);
});
test('loaded summaries preserve nulls, statuses, review metadata and source excerpts; unsupported versions are blocked', () => {
  const summary = supportingSummary(examples[1].summary);
  const saved = { id: 'id', groupId: 'group', title: 'Saved', revision: 1, createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z', payload: { title: 'Saved', summaryVersion: 1 as const, summary, provenance: [], origin: 'sample' as const } };
  assert.deepEqual(validateLoadedSession(saved), saved);
  assert.throws(() => validateLoadedSession({ ...saved, payload: { ...saved.payload, summaryVersion: 2 } } as unknown as typeof saved));
});

test('identity reset preserves anonymous work at first sign-in and token refresh but clears previous account work', () => {
  const identity = new AccountIdentity();
  assert.equal(identity.accept(null), 0); assert.equal(identity.accept('A'), 0);
  assert.equal(identity.accept('A'), 0); assert.equal(identity.accept(null), 1);
  assert.equal(identity.accept('A'), 1); assert.equal(identity.accept('B'), 2);
  assert.equal(identity.accept('B'), 2);
});

test('typing or opening an unapplied editor during an async load/save invalidates its empty-workspace/saved assumption', () => {
  const edits = new WorkspaceEdits(); const capturedBeforeRequest = edits.revision;
  const delayedOpenNeedsConfirmation = () => edits.hasWork();
  assert.equal(delayedOpenNeedsConfirmation(), false);
  edits.change(); // Input capture runs synchronously, before a React effect.
  assert.equal(delayedOpenNeedsConfirmation(), true);
  assert.equal(edits.changedSince(capturedBeforeRequest), true);
  const latestSave = edits.revision;
  assert.equal(edits.changedSince(latestSave), false);
  edits.change(); // A fact form is opened/typed after that save began.
  assert.equal(edits.changedSince(latestSave), true);
});
