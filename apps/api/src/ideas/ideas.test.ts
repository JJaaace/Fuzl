import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { emptyIdea, ideaContentSchema, ideaSchema, ideaPlace, ideaEvent, ideaDateState, duplicateIdea, normalizedIdeaLink, demoPlaceQuery, demoPlaceSummary, demoPlaces, evaluatePlaces, evaluateEvents, shortlistPlace, shortlistEvent, memoryInfluence, ballotSourceUrl, placeSearchSchema, emptySelection, initialEvidence, detailsFromOption, planDetailsSchema } from '@fuzl/planning';
import type { SavedIdea } from '@fuzl/planning';
import { createApp } from '../app.js';
const now = Date.parse('2026-11-14T18:00:00.000Z');
const row = (content = { ...emptyIdea(), name: 'Synthetic night market' }): SavedIdea => ideaSchema.parse({ id: randomUUID(), groupId: randomUUID(), revision: 1, content, origin: { provider: 'manual', itemId: null, referenceUrl: content.link }, archived: false, edited: false, dateState: ideaDateState(content, now), createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() });
test('compact idea supports an explicit unknown link and checked date; blank/invalid/credential links, malformed dates and invented price fields fail safely', () => {
  const basic = { ...emptyIdea(), name: 'A walk', note: 'PRIVATE Sam wants to try it' }; assert.ok(ideaContentSchema.safeParse(basic).success); assert.equal(basic.link, null); assert.equal(basic.lastCheckedOn, null);
  for (const patch of [{ name: '' }, { link: '' }, { link: 'bad-url' }, { link: 'javascript:alert(1)' }, { link: 'https://user:password@example.com/' }, { link: 'https://example.com/?apiKey=synthetic' }, { link: 'https://example.com/#invite=synthetic' }, { eventDate: '2026-02-30', kind: 'event' }, { price: 0 }, { lat: 1, lon: null }]) assert.equal(ideaContentSchema.safeParse({ ...basic, ...patch }).success, false);
});
test('saved idea import drops notes and volatile evidence, retains provenance and nullable source, and cannot make unknown cost pass a firm budget', () => {
  const i = row({ ...emptyIdea(), name: 'Unlinked walk', note: 'PRIVATE attendee preference and budget 17.31', address: 'Synthetic gate', lastCheckedOn: '2026-11-07' }), c = ideaPlace(i);
  assert.equal(c.sourceUrl, null); assert.equal(c.price.amount, null); assert.equal(c.hours.kind, 'unknown'); assert.equal(c.visit, undefined); assert.equal(c.savedIdea?.lastCheckedOn, '2026-11-07'); assert.ok(!JSON.stringify(c).includes('PRIVATE')); assert.ok(!JSON.stringify(c).includes('17.31'));
  const found = demoPlaces(demoPlaceQuery, new Date(now).toISOString()); assert.ok('area' in found); const second = ideaPlace(row({ ...emptyIdea(), name: 'Other unlinked idea' }));
  const r = evaluatePlaces([c, second], found.area, demoPlaceQuery, demoPlaceSummary()); assert.equal(r.verified.length, 0); assert.equal(r.promising.length, 2, 'unknown links must not deduplicate unrelated ideas');
  const option = shortlistPlace(r.promising[0], randomUUID()); assert.deepEqual(option.links, []); assert.equal(option.cost.amount, null); assert.ok(!JSON.stringify(option).includes('PRIVATE')); assert.equal(memoryInfluence(null, [{ sourceUrl: null, date: '2026-11-07', takeaway: 'Liked it', sentiment: 'positive' }]), undefined);
});
test('dated event expiry uses its local calendar and excludes unknown boundary dates rather than inventing a zone; event status/price remain unknown on import', () => {
  const c = { ...emptyIdea(), name: 'Synthetic event', kind: 'event' as const, eventDate: '2026-11-14', timeZone: 'America/New_York' };
  assert.equal(ideaDateState(c, Date.parse('2026-11-15T02:00:00Z')), 'upcoming', 'still November 14 in New York');
  assert.equal(ideaDateState({ ...c, timeZone: 'Asia/Tokyo' }, Date.parse('2026-11-15T02:00:00Z')), 'past');
  assert.equal(ideaDateState({ ...c, timeZone: null }, Date.parse('2026-11-15T02:00:00Z')), 'date-needs-checking');
  assert.equal(ideaDateState({ ...c, eventDate: null }, now), 'date-needs-checking');
  const event = ideaEvent(row(c)); assert.equal(event.source, 'organizer'); assert.equal(event.providerStatus, null); assert.equal(event.price.amount, null); assert.equal(event.schedule.time, null);
  const f = demoPlaces(demoPlaceQuery, new Date(now).toISOString()); assert.ok('area' in f); const r = evaluateEvents([event], f.area, { area: demoPlaceQuery.area, radiusKm: 5, from: c.eventDate, to: c.eventDate }, demoPlaceSummary()); assert.equal(r.verified.length, 0); const o = shortlistEvent(r.promising[0], randomUUID()); assert.equal(o.cost.amount, null); assert.deepEqual(o.links, []);
});
test('duplicate detection is group-local in the store and retains date/query distinctions while warning on the same provider item across dates', () => {
  assert.equal(normalizedIdeaLink('https://example.com/venue/?utm_source=test#part'), normalizedIdeaLink('https://example.com/venue'));
  const a = row({ ...emptyIdea(), name: 'One', link: 'https://example.com/events?id=1' }), b = row({ ...emptyIdea(), name: 'Two', link: 'https://example.com/events?id=1&utm_medium=chat' }); assert.ok(duplicateIdea(a, b));
  b.content.link = 'https://example.com/events?id=2'; assert.equal(duplicateIdea(a, b), false);
  a.origin = { provider: 'ticketmaster', itemId: 'specific-event', referenceUrl: a.content.link }; b.origin = { ...a.origin }; b.content.eventDate = '2099-01-02'; assert.ok(duplicateIdea(a, b), 'repeat is warned, not prohibited; explicit allowance is handled by store');
});
test('saved Geoapify attribution survives public conversion, is distinct from a venue source, and manual/saved additions share the existing bound', () => {
  const i = row({ ...emptyIdea(), name: 'Saved park', link: 'https://example.com/park', note: 'PRIVATE note' }); i.origin = { provider: 'geoapify', itemId: 'geo-1', referenceUrl: i.content.link };
  const f = demoPlaces(demoPlaceQuery, new Date(now).toISOString()); assert.ok('area' in f); const assessed = evaluatePlaces([ideaPlace(i)], f.area, demoPlaceQuery, demoPlaceSummary()).promising[0], option = shortlistPlace(assessed, randomUUID());
  assert.equal(option.links.length, 3); assert.equal(option.links.filter(l => l.kind === 'attribution').length, 2); assert.equal(ballotSourceUrl({ ...option, links: option.links.filter(l => l.kind === 'attribution') }), null); assert.ok(!JSON.stringify(option).includes('PRIVATE'));
  const candidate = ideaPlace(i), sourceUrl = 'https://example.com/official-park';
  candidate.evidence = { ...initialEvidence(candidate), selected: { ...emptySelection(), 'official-link': 'official' }, claims: [...initialEvidence(candidate).claims, { id: 'official', field: 'official-link', value: sourceUrl, matchNote: 'Organizer matched this exact venue.', source: { kind: 'official-page', url: sourceUrl, checkedOn: '2026-11-14', verifiedForVenue: true } }] };
  const checked = evaluatePlaces([candidate], f.area, demoPlaceQuery, demoPlaceSummary()).promising[0], withOfficial = shortlistPlace(checked, randomUUID());
  assert.equal(withOfficial.links.length, 4, 'preserve the specific source, matched official page and both attribution links');
  assert.ok(withOfficial.links.some(l => l.url === sourceUrl));
  assert.equal(planDetailsSchema.parse(detailsFromOption(withOfficial)).links.length, 4);
  const manual = { name: 'manual', sourceUrl: null, address: null, category: 'any', lat: null, lon: null, price: { amount: null, currency: null, basis: 'unknown', coverage: 'unknown' }, hours: { kind: 'unknown', text: null, date: null, start: null, end: null, timeZone: null, closed: false } };
  assert.equal(placeSearchSchema.safeParse({ mode: 'demo', sessionRevision: 1, summary: demoPlaceSummary(), query: demoPlaceQuery, manual: [manual, manual, manual], savedIdeas: [{ id: randomUUID(), revision: 1 }] }).success, false);
});
test('new owned idea routes require identity/origin and sanitize invalid input and storage failures without logging private notes or credentials', async t => {
  let logs = 0; t.mock.method(console, 'error', () => { logs++; });
  const server = createApp({ accounts: { verify: async () => randomUUID(), ideas: { store: () => { throw Error('PRIVATE connection-string token'); } } } }).listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); t.after(() => new Promise<void>(r => server.close(() => r())));
  const url = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/private/groups/${randomUUID()}/ideas`, headers = { Authorization: 'Bearer synthetic-organizer-token', 'Content-Type': 'application/json' };
  assert.equal((await fetch(url)).status, 401); const r = await fetch(url, { headers }); assert.equal(r.status, 503); assert.equal(r.headers.get('cache-control'), 'no-store, private'); assert.ok(!(await r.text()).includes('PRIVATE'));
  assert.equal((await fetch(url, { headers: { ...headers, Origin: 'https://another.example' } })).status, 403); assert.equal(logs, 0);
});
