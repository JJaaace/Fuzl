import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { publicAccountConfiguration, verifyOrganizer } from './auth.js';
import { ExtractionError } from '../extraction/errors.js';
import { supportingSummary, excerptProvenance, sessionInputSchema, quotesUnchanged, providerOutputSchema, planningSummarySchema, blankFact } from '@fuzl/planning';
import { evaluationCases } from '../extraction/cases.js';
import { validateExtraction } from '../extraction/validate.js';
function configured(t: TestContext) {
  for (const [key, value] of Object.entries({ SUPABASE_URL: 'https://synthetic-project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' })) {
    const old = process.env[key]; process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
}
test('account configuration exposes only designated public values; secret keys are rejected', (t) => {
  configured(t); assert.deepEqual(publicAccountConfiguration(), { configured: true, url: 'https://synthetic-project.supabase.co', publishableKey: 'sb_publishable_test-only' });
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_secret_do-not-expose';
  assert.throws(publicAccountConfiguration, (error: unknown) => error instanceof ExtractionError && !error.message.includes('sb_secret'));
  delete process.env.SUPABASE_PUBLISHABLE_KEY; assert.deepEqual(publicAccountConfiguration(), { configured: false });
});
test('Supabase verifies the supplied token remotely; provider errors never echo tokens', async (t) => {
  configured(t); const subject = '11111111-1111-4111-8111-111111111111'; const token = 'synthetic-secret-access-token';
  await t.test('valid verified user', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
      assert.equal(String(url), 'https://synthetic-project.supabase.co/auth/v1/user');
      assert.equal(new Headers(options.headers).get('authorization'), `Bearer ${token}`);
      return Response.json({ id: subject, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', email_confirmed_at: '2026-11-06T00:00:00Z' });
    });
    assert.equal(await verifyOrganizer(token), subject);
  });
  await t.test('invalid or expired token', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: token, code: 'bad_jwt' }, { status: 401 }));
    await assert.rejects(verifyOrganizer(token), (error: unknown) => error instanceof ExtractionError && error.status === 401 && !error.message.includes(token));
  });
  await t.test('anonymous or unconfirmed email accounts cannot own saved work', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ id: subject, aud: 'authenticated', email: 'synthetic@example.invalid', is_anonymous: true }));
    await assert.rejects(verifyOrganizer(token), (error: unknown) => error instanceof ExtractionError && error.status === 401);
  });
  await t.test('provider unavailable', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: token }, { status: 503 }));
    await assert.rejects(verifyOrganizer(token), (error: unknown) => error instanceof ExtractionError && error.status === 503 && !error.message.includes(token));
  });
});
test('save boundary keeps cited excerpts/correction provenance and rejects raw imports or unknown schema versions', () => {
  const item = evaluationCases[1]; const full = validateExtraction(item.authoredOutput, item.request).summary;
  full.sources.push({ id: 'unused', speakerId: full.speakers[0].id, text: 'Unrelated private message' });
  const summary = supportingSummary(full);
  assert.equal(summary.sources.length, 1); assert.equal(full.sources.length, 2);
  const payload = { title: 'Synthetic', summaryVersion: 1, summary, origin: 'ai', provenance: [] };
  assert.equal(sessionInputSchema.safeParse(payload).success, true);
  assert.equal(sessionInputSchema.safeParse({ ...payload, conversation: 'raw import' }).success, false);
  assert.equal(sessionInputSchema.safeParse({ ...payload, screenshots: ['raw image'] }).success, false);
  assert.equal(sessionInputSchema.safeParse({ ...payload, summaryVersion: 2 }).success, false);
  assert.equal(sessionInputSchema.safeParse({ ...payload, summary: full }).success, false);
  const parsed = sessionInputSchema.parse(payload); const edited = structuredClone(parsed); edited.summary.sources[0].text = 'Changed quote';
  assert.equal(quotesUnchanged(parsed, edited), false);
  const removed = { ...parsed, summary: { ...parsed.summary, facts: [], sources: [], questions: [] }, provenance: [] };
  assert.equal(sessionInputSchema.safeParse(removed).success, true); assert.equal(quotesUnchanged(parsed, removed), true);
  const manual = blankFact('budget', 'manual');
  assert.equal(planningSummarySchema.safeParse({ participants: [], speakers: [], sources: [], questions: [], facts: [manual] }).success, false, 'AI response evidence validation remains strict');
  assert.equal(sessionInputSchema.safeParse({ ...payload, origin: 'manual', summary: { participants: [], speakers: [], sources: [], facts: [manual], questions: [] } }).success, true);
  assert.equal(providerOutputSchema.safeParse({ participants: [], speakers: [], sources: [], questions: [], facts: [{ fact: manual, uncertainty: 'Unknown', scope: 'current', supersedes: [] }] }).success, false);
  const snapshot = { id: 't1', draft: 'Alex: My firm spending limit is USD 0 per person.', messages: [{ id: 'm1', screenshotId: 's1', speakerLabel: 'Alex', text: 'My firm spending limit is USD 0 per person.', visibleDateTime: null, uncertainty: null, possibleDuplicateOf: null }], original: { screenshots: [{ id: 's1', notes: [] }], messages: [{ id: 'm1', screenshotId: 's1', speakerLabel: null, text: 'My firm spending limit is USD 0 per person.', visibleDateTime: null, uncertainty: 'Cropped label', possibleDuplicateOf: null }] } };
  const evidence = excerptProvenance(summary, snapshot);
  assert.equal(evidence[0].entries[0].originalSpeaker, null); assert.equal(evidence[0].entries[0].reviewedSpeaker, 'Alex');
  assert.ok(!JSON.stringify(evidence).includes('"draft"'));
});
