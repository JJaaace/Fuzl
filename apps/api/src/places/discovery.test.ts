import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoveryFixture, evaluatePlaces, evaluateEvents, demoEvents, rankDiscovery, discoveryEvidence, discoveryPreferenceSchema, placeResultsSchema, eventResultsSchema, shortlistPlace } from '@fuzl/planning';
const modes = ['balanced', 'familiar', 'new'] as const;
function evaluated(group: 'a' | 'b' = 'a') {
  const f = discoveryFixture(group);
  return { f, result: evaluatePlaces(f.found.candidates, f.found.area, f.query, f.summary, [], f.memories, f.history) };
}
test('one synthetic list preserves balanced order, boosts favorites/new within fit categories and never waives the firm budget or unknown details', () => {
  const { result } = evaluated(); const pool = result.ranked!;
  assert.equal(pool.length, 4);
  assert.deepEqual(pool.map(r => r.candidate.name), ['Synthetic favorite garden', 'Synthetic saved night market', 'Synthetic mixed-feedback cafe', 'Synthetic over-budget favorite']);
  assert.deepEqual(rankDiscovery(pool, 'balanced').ordered, pool);
  assert.equal(rankDiscovery(pool, 'familiar').ordered[0].candidate.name, 'Synthetic favorite garden');
  const next = rankDiscovery(pool, 'new'); assert.equal(next.changed, true); assert.equal(next.ordered[0].candidate.name, 'Synthetic saved night market');
  assert.equal(next.ordered[0].candidate.price.amount, null); assert.equal(next.ordered[1].candidate.hours.kind, 'unknown');
  assert.equal(pool[2].discovery?.favorite, false); assert.ok(pool[2].discovery?.reason.includes('feedback was mixed'));
  for (const mode of modes) {
    const ranked = rankDiscovery(pool, mode).ordered;
    assert.equal(ranked.at(-1)!.candidate.id, 'expensive'); assert.equal(ranked.at(-1)!.status, 'does-not-fit');
    assert.equal(ranked.filter(r => r.status === 'fits').length, 0);
    for (const row of ranked) assert.deepEqual(row.checks, pool.find(b => b.candidate.id === row.candidate.id)!.checks);
    assert.ok(!JSON.stringify(ranked).includes('PRIVATE'));
    const publicOption = shortlistPlace(ranked[0], crypto.randomUUID()); for (const field of ['discovery', 'memory', 'takeaway']) assert.ok(!(field in publicOption));
  }
  assert.equal(placeResultsSchema.parse({ mode: 'demo', retrievedAt: '2026-11-14T12:00:00Z', ...result }).ranked?.length, 4);
});
test('another group with no matching history keeps usual order and receives no positive/mixed explanation from the first group', () => {
  const { result } = evaluated('b'); const pool = result.ranked!;
  assert.ok(pool.every(r => !r.memory && !r.discovery?.favorite && r.discovery?.visit === 'no-recorded-visit'));
  for (const mode of ['familiar', 'new'] as const) { const ranked = rankDiscovery(pool, mode); assert.deepEqual(ranked.ordered, pool); assert.equal(ranked.changed, false); assert.ok(ranked.notice.includes('Too little matched group history')); }
});
test('explicit unmatched outings, capped history, no link and absent history remain unknown; matching only names never creates a favorite', () => {
  const history = { sourceUrls: ['https://example.com/exact'], uncertain: false };
  assert.equal(discoveryEvidence(history.sourceUrls[0], undefined, history).visit, 'recorded');
  assert.equal(discoveryEvidence(history.sourceUrls[0], undefined, history).favorite, false, 'an actual visit alone is not positive approved feedback');
  assert.equal(discoveryEvidence(null, undefined, history).visit, 'unknown');
  assert.equal(discoveryEvidence('https://example.com/new', undefined).visit, 'unknown');
  assert.equal(discoveryEvidence('https://example.com/new', undefined, { ...history, uncertain: true }).visit, 'unknown');
  assert.equal(discoveryEvidence('https://example.com/different-listing', undefined, history).favorite, false);
  assert.equal(discoveryEvidence('https://example.com/exact', { boost: 2, sentiment: 'positive' }, { sourceUrls: [], uncertain: true }).favorite, true, 'an exact approved memory already proves a completed explicit listing match beyond the bounded history window');
  assert.equal(discoveryPreferenceSchema.safeParse('hidden-gems').success, false);
});
test('small stable moves do not cross fit categories, promote excluded favorites, accumulate across toggles or force changes without comparable history', () => {
  const f = { visit: 'recorded' as const, favorite: true, reason: 'Your group liked this last time' }, n = { visit: 'no-recorded-visit' as const, favorite: false, reason: 'No visit recorded' };
  const pool = [{ id: 'checked', status: 'fits' as const, discovery: n }, ...Array.from({ length: 6 }, (_, i) => ({ id: `candidate-${i}`, status: 'needs-checking' as const, discovery: i === 5 ? f : n })), { id: 'excluded', status: 'does-not-fit' as const, discovery: f }];
  const ranked = rankDiscovery(pool, 'familiar'); assert.equal(ranked.ordered[0].id, 'checked'); assert.ok(ranked.ordered.findIndex(r => r.id === 'candidate-5') >= 4); assert.equal(ranked.ordered.at(-1)!.id, 'excluded');
  assert.deepEqual(rankDiscovery(pool, 'balanced').ordered, pool); assert.deepEqual(rankDiscovery(pool, 'familiar').ordered, ranked.ordered);
  assert.equal(rankDiscovery([{ ...pool[0], discovery: n }], 'new').changed, false);
});
test('events reuse the same bounded preference but keep cancellation, date, starting-price/fees, and private affordability checks intact', () => {
  const f = discoveryFixture(), query = { area: f.query.area, radiusKm: 5, from: '2026-11-14', to: '2026-11-14' }, data = demoEvents(query, '2026-11-14T12:00:00Z'); assert.ok('events' in data);
  const base = data.events[0]; const events = ['old', 'new', 'cancelled'].map((id, i) => ({ ...base, id, sourceUrl: `https://example.com/discovery/events/${id}`, providerStatus: i === 2 ? 'cancelled' : 'scheduled', price: { ...base.price, amount: 10, kind: 'starting' as const, fees: 'unknown' as const } }));
  const history = { sourceUrls: [events[0].sourceUrl, events[2].sourceUrl], uncertain: false };
  const result = evaluateEvents(events, data.area, query, f.summary, [{ amount: .17, currency: 'USD', state: 'known' }], [], history);
  for (const mode of modes) { const ranked = rankDiscovery(result.ranked!, mode).ordered; assert.equal(ranked.filter(r => r.status === 'fits').length, 0); assert.equal(ranked.find(r => r.event.id === 'cancelled')!.status, 'does-not-fit'); assert.ok(ranked.every(r => r.event.price.kind === 'starting')); assert.ok(!JSON.stringify(ranked).includes('0.17')); }
  assert.equal(eventResultsSchema.parse({ mode: 'demo', area: data.area, query, retrievedAt: '2026-11-14T12:00:00Z', ...result }).ranked?.length, 3);
});

test('history query is bounded and group-scoped, excludes names/notes/feedback, and treats truncated or corrected records conservatively', async () => {
  const { groupVisitHistory } = await import('../outings/store.js');
  const { shortlistPlace, detailsFromOption } = await import('@fuzl/planning');
  const { result } = evaluated(); const option = shortlistPlace(result.ranked![0], crypto.randomUUID());
  const original = { ballotId: crypto.randomUUID(), option, details: detailsFromOption(option) };
  let count = 1, sameListing = true;
  const tx = { outing: { findMany: async (query: unknown) => {
    const q = query as { where: unknown; take: number; select: Record<string, unknown> };
    assert.deepEqual(q.where, { groupId: 'owned-synthetic-group', plan: { status: 'completed' } }); assert.equal(q.take, 101);
    for (const forbidden of ['feedback', 'answers', 'privateNotes', 'confirmedAttendees', 'actual']) assert.ok(!(forbidden in q.select));
    return Array.from({ length: count }, (_, i) => ({ id: String(i), revision: 1, sameListing, original }));
  } } } as unknown as import('../generated/prisma/client.js').Prisma.TransactionClient;
  assert.equal((await groupVisitHistory(tx, 'owned-synthetic-group')).history.uncertain, false);
  count = 101; assert.equal((await groupVisitHistory(tx, 'owned-synthetic-group')).history.uncertain, true);
  count = 1; sameListing = false; const changed = await groupVisitHistory(tx, 'owned-synthetic-group'); assert.deepEqual(changed.history, { sourceUrls: [], uncertain: true });
});
