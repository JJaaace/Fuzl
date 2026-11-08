import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correctedPlace, correctionSchema, demoPlaces, demoPlaceQuery, demoPlaceSummary, emptySelection, evaluatePlaces, listingKey, localInstant, parseUsArea, placeEvidence, placeResultsSchema, venueWindow } from '@fuzl/planning';
import type { PlaceCandidate, PlaceCorrection, PlaceQuery } from '@fuzl/planning';
import { GeoapifyProvider } from './provider.js';
import { PlaceSearchCache } from './cache.js';
const stamp = '2026-11-07T12:00:00.000Z';
function fixture(query: PlaceQuery) { const found = demoPlaces(query, stamp); assert.ok('area' in found); return found; }
function evaluate(c: PlaceCandidate, q = demoPlaceQuery) { const found = fixture(demoPlaceQuery); return evaluatePlaces([c], found.area, q, demoPlaceSummary()); }
const query = (area: string) => ({ ...demoPlaceQuery, area });
test('US resolution preserves leading-zero ZIPs, normalizes states/abbreviations and accepts suburbs without location guesses', async () => {
  assert.equal(parseUsArea('02108')?.zip, '02108'); assert.equal(parseUsArea('2108'), null); assert.equal(parseUsArea('Boston, ZZ'), null);
  const urls: URL[] = [];
  const provider = new GeoapifyProvider('synthetic-key', (async (input: Parameters<typeof fetch>[0]) => { const url = new URL(String(input)); urls.push(url); if (url.pathname.includes('geocode')) return Response.json({ results: [{ country_code: 'us', result_type: 'postcode', postcode: '02108', formatted: 'Boston, MA 02108', lat: 42.357, lon: -71.063, timezone: { name: 'America/New_York' } }] }); return Response.json({ features: [] }); }) as typeof fetch);
  const result = await provider.search({ area: '02108', radiusKm: 5, category: 'any' }, AbortSignal.timeout(2000));
  assert.ok('area' in result); assert.equal(result.area.postcode, '02108'); assert.equal(urls[0].searchParams.get('postcode'), '02108'); assert.equal(urls.length, 2);
  for (const [area, row] of [
    ['St. Louis, Missouri', { city: 'Saint Louis', state_code: 'MO', result_type: 'city' }],
    ['Brookline, Massachusetts', { city: null, town: 'Brookline', state_code: 'US-MA', result_type: 'suburb' }],
  ] as const) {
    let calls = 0;
    const p = new GeoapifyProvider('key', (async (input: Parameters<typeof fetch>[0]) => { calls++; const url = new URL(String(input)); return url.pathname.includes('geocode') ? Response.json({ results: [{ ...row, country_code: 'us', formatted: area, lat: 42, lon: -71 }] }) : Response.json({ features: [] }); }) as typeof fetch);
    assert.ok('area' in await p.search({ area, category: 'park', radiusKm: 5 }, AbortSignal.timeout(2000))); assert.equal(calls, 2);
  }
});
test('ambiguous cities ask for a bounded choice before places; selection is revalidated and cross-state candidates retain their actual locality', async () => {
  const urls: URL[] = [];
  const matches = [{ place_id: 'ma', city: 'Springfield', state_code: 'MA', lat: 42.1, lon: -72.6 }, { place_id: 'il', city: 'Springfield', state_code: 'IL', lat: 39.8, lon: -89.6 }].map(r => ({ ...r, result_type: 'city', country_code: 'us', formatted: `Springfield, ${r.state_code}` }));
  const p = new GeoapifyProvider('key', (async (input: Parameters<typeof fetch>[0]) => { const u = new URL(String(input)); urls.push(u); return u.pathname.includes('geocode') ? Response.json({ results: matches }) : Response.json({ features: [{ properties: { place_id: 'venue', name: 'Synthetic neighbor', city: 'Neighbor city', state_code: 'IA', lat: 39.8, lon: -89.61, categories: ['leisure.park'], website: 'https://unverified.example/' } }] }); }) as typeof fetch);
  const first = await p.search({ area: 'Springfield', category: 'park', radiusKm: 5 }, AbortSignal.timeout(2000));
  assert.ok('choices' in first); assert.equal(first.choices.length, 2); assert.equal(urls.length, 1);
  const second = await p.search({ area: 'Springfield', resolutionId: 'il', category: 'park', radiusKm: 5 }, AbortSignal.timeout(2000));
  assert.ok('area' in second); assert.equal(second.area.state, 'IL'); assert.equal(second.candidates[0].state, 'IA'); assert.equal(second.candidates[0].city, 'Neighbor city');
  assert.ok(urls[2].searchParams.get('filter')?.includes('circle:-89.6,39.8,5000')); assert.ok(!urls[2].searchParams.has('state')); assert.equal(urls.length, 3);
  assert.equal(placeEvidence(second.candidates[0]).official, null, 'a provider website is not promoted to an official identity match');
  await assert.rejects(p.search({ area: 'Springfield', resolutionId: 'invented', category: 'park', radiusKm: 5 }, AbortSignal.timeout(2000)), /choice/);
});
test('large-city, suburb, sparse-town, cross-state and ambiguous fixtures remain driven by the selected location', () => {
  const boston = fixture(query('02108')), suburb = fixture(query('02445')), town = fixture(query('Marfa, TX'));
  assert.equal(boston.area.city, 'Boston'); assert.equal(suburb.area.city, 'Brookline'); assert.equal(town.candidates.length, 1);
  assert.equal(fixture({ ...query('79843'), radiusKm: 10 }).candidates.length, 2);
  assert.equal(fixture({ ...query('79843'), category: 'park' }).candidates.length, 0);
  const cross = fixture(query('Philadelphia, PA'));
  const result = evaluatePlaces(cross.candidates, cross.area, query('Philadelphia, PA'), demoPlaceSummary());
  assert.ok(result.excluded.some(r => r.candidate.city === 'Camden' && r.candidate.state === 'NJ' && r.checks.some(c => c.kind === 'budget' && c.status === 'does-not-fit')), 'firm budget still excludes the cross-state example');
  assert.ok(result.excluded.find(r => r.candidate.city === 'Camden')!.checks.some(c => c.kind === 'radius' && c.status === 'fits'), 'state border is not the radius boundary');
  const ambiguous = demoPlaces(query('Springfield'), stamp); assert.ok('choices' in ambiguous); assert.equal(ambiguous.choices.length, 2);
});
test('Columbus address disagreements retain both sources and confirming a new address cannot inherit old geometry/hours', () => {
  const c = fixture({ ...query('43210'), category: 'museum' }).candidates[0];
  const evidence = placeEvidence(c); assert.equal(evidence.addressConflict, true); assert.equal(evidence.addressNeedsChecking, true);
  assert.equal(evidence.addresses.length, 2); assert.equal(evidence.official, null);
  const alternative = evidence.addresses.find(a => !a.id.startsWith('listing-'))!;
  const correction: PlaceCorrection = { candidateId: c.id, candidateSource: c.source, listingKey: listingKey(c), claims: [alternative], selected: { ...emptySelection(), address: alternative.id }, confirmedOn: '2026-11-07' };
  const accepted = correctedPlace(c, [correction]);
  assert.equal(placeEvidence(accepted).addressNeedsChecking, false);
  assert.equal(placeEvidence(accepted).effective.lat, null);
  const result = evaluate(accepted);
  assert.equal(result.verified.length, 0); assert.equal(result.promising[0].distanceKm, null);
  assert.equal(accepted.evidence!.claims.find(a => a.id === 'listing-address')!.source.url, c.sourceUrl);
  assert.ok(accepted.evidence!.claims.some(a => a.source.checkedOn === '2026-11-07'));
  const stale = correctedPlace({ ...c, address: 'A newer provider address' }, [correction]);
  assert.equal(stale.evidence!.listingChanged, true); assert.equal(placeEvidence(stale).addressNeedsChecking, true); assert.equal(stale.evidence!.claims.length, 2);
  const original = fixture(demoPlaceQuery).candidates[0];
  const moved = correctedPlace(original, [{ ...correction, candidateId: original.id, listingKey: listingKey(original) }]);
  assert.equal(placeEvidence(moved).effective.price.amount, null, 'old-address price is not applied to a different confirmed address');
  assert.equal(placeEvidence(moved).effective.hours.kind, 'unknown', 'old-address hours are not reused');
});
test('official-page attestation, source dates and address-bound hours survive evaluation without turning admission into a total price', () => {
  const c = fixture(demoPlaceQuery).candidates[0];
  const source = { kind: 'official-page' as const, url: 'https://example.com/official-venue', checkedOn: '2026-11-07', verifiedForVenue: true };
  const correction: PlaceCorrection = { candidateId: c.id, candidateSource: c.source, listingKey: listingKey(c), selected: { ...emptySelection(), 'official-link': 'official', price: 'admission' }, claims: [
    { id: 'official', field: 'official-link', value: source.url, matchNote: 'Exact venue name and street address checked together', source },
    { id: 'admission', field: 'price', value: { amount: 0, currency: 'USD', basis: 'per-person', coverage: 'admission-only' }, source },
  ] };
  assert.equal(correctionSchema.safeParse(correction).success, true);
  assert.equal(correctionSchema.safeParse({ ...correction, claims: [{ ...correction.claims[0], source: { ...source, verifiedForVenue: false } }] }).success, false);
  const accepted = correctedPlace(c, [correction]);
  assert.equal(placeEvidence(accepted).official?.value, source.url);
  const evaluated = evaluate(accepted); assert.equal(evaluated.verified.length, 0);
  const dto = placeResultsSchema.parse({ mode: 'demo', retrievedAt: stamp, ...evaluated });
  assert.equal(dto.promising[0].candidate.evidence!.claims[1].source.checkedOn, '2026-11-07');
  assert.ok(dto.promising[0].checks.some(check => check.kind === 'booking' && check.status === 'needs-checking'));
});
test('venue-local windows convert across zones and reject DST gaps, folds and overnight model ambiguity', () => {
  assert.deepEqual(venueWindow('2026-11-14', '15:00', '17:00', 'America/New_York', 'America/Chicago'), { date: '2026-11-14', start: '14:00', end: '16:00', timeZone: 'America/Chicago' });
  assert.equal(localInstant('2026-11-01', '01:30', 'America/New_York'), null);
  assert.equal(localInstant('2026-03-08', '02:30', 'America/New_York'), null);
  assert.equal(venueWindow('2026-11-14', '02:30', '04:30', 'America/New_York', 'America/Los_Angeles'), null);
  const c = fixture(demoPlaceQuery).candidates[0];
  const timed = { ...c, timeZone: 'America/Chicago', hours: { ...c.hours, start: '14:00', end: '16:00', timeZone: 'America/Chicago' } };
  assert.ok(evaluate(timed).verified.length === 1, 'dated hours use venue-local time rather than the search-area zone');
  const summary = demoPlaceSummary(); summary.facts.push({ id: 'fixed-window', kind: 'schedule', description: null, exactDate: demoPlaceQuery.date, startTime: '14:00', endTime: '18:00', subject: { kind: 'group' }, status: 'confirmed', strength: 'firm', sourceIds: [] });
  const found = fixture(demoPlaceQuery);
  assert.equal(evaluatePlaces([c], found.area, { ...demoPlaceQuery, start: '13:00', timeZone: null }, summary).excluded.length, 1, 'venue-local default cannot bypass a firm planning window');
});
test('bounded public-venue cache enforces owner/session and expiration without storing planning data', () => {
  let now = 0;
  const cache = new PlaceSearchCache(() => now), found = fixture(demoPlaceQuery);
  const id = cache.put({ subject: 'owner', sessionId: 'session', revision: 1, contextVersion: 'internal-hash', queryKey: 'boundary', area: found.area, candidates: found.candidates, mode: 'demo' });
  assert.equal(cache.get(id, 'owner', 'session').candidates.length, 3);
  assert.throws(() => cache.get(id, 'other', 'session')); assert.throws(() => cache.get(id, 'owner', 'other-session'));
  now = 600001; assert.throws(() => cache.get(id, 'owner', 'session'), /expired/);
});
