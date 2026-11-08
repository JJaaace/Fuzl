import { initialEvidence } from './place-evidence.js';
import { parseUsArea, normalizePlaceName } from './place-location.js';
import { emptySummary } from './model.js';
import type { PlanningSummary } from './model.js';
import { unknownHours, unknownPrice } from './places.js';
import type { PlaceArea, PlaceCandidate, PlaceQuery, PlaceDiscovery, AreaChoice } from './places.js';
// Hand-authored synthetic places, not provider analysis or verified real venues.
const areas: Record<string, PlaceArea> = {
  'columbus, oh': { label: 'Demo Columbus / Ohio State area', lat: 40.0017, lon: -83.0197, timeZone: 'America/New_York' },
  'boston, ma': { label: 'Demo Boston, MA 02108', lat: 42.357, lon: -71.063, timeZone: 'America/New_York', city: 'Boston', state: 'MA', postcode: '02108' },
  'brookline, ma': { label: 'Demo Brookline, MA 02445', lat: 42.332, lon: -71.121, timeZone: 'America/New_York', city: 'Brookline', state: 'MA', postcode: '02445' },
  'marfa, tx': { label: 'Demo Marfa, TX 79843', lat: 30.309, lon: -104.021, timeZone: 'America/Chicago', city: 'Marfa', state: 'TX', postcode: '79843' },
  'philadelphia, pa': { label: 'Demo Philadelphia, PA 19103', lat: 39.952, lon: -75.165, timeZone: 'America/New_York', city: 'Philadelphia', state: 'PA', postcode: '19103' },
  'springfield, ma': { label: 'Demo Springfield, MA', lat: 42.102, lon: -72.589, timeZone: 'America/New_York', city: 'Springfield', state: 'MA', postcode: '01103' },
  'springfield, il': { label: 'Demo Springfield, IL', lat: 39.801, lon: -89.644, timeZone: 'America/Chicago', city: 'Springfield', state: 'IL', postcode: '62701' },
  'cleveland, oh': { label: 'Demo Cleveland area', lat: 41.4993, lon: -81.6944, timeZone: 'America/New_York' },
};
export const demoPlaceQuery: PlaceQuery = { area: 'Columbus, OH', radiusKm: 5, category: 'any', date: '2026-11-14', start: '15:00', end: '17:00', timeZone: 'America/New_York' };
export function demoPlaceSummary(): PlanningSummary {
  return { ...emptySummary(), facts: [
    { id: 'demo-budget', kind: 'budget', subject: { kind: 'group' }, status: 'confirmed', strength: 'firm', sourceIds: [], amount: 20, currency: 'USD' },
    { id: 'demo-activity', kind: 'activity', subject: { kind: 'group' }, status: 'confirmed', strength: 'flexible', sourceIds: [], description: 'park' },
  ] };
}
export function demoPlaces(query: PlaceQuery, retrievedAt: string): PlaceDiscovery {
  const requested = parseUsArea(query.area);
  if (!requested) throw new Error('Invalid demo area.');
  const choices: AreaChoice[] = ['springfield, ma', 'springfield, il'].map(id => ({ ...areas[id], id }));
  const zipKeys: Record<string, string> = { '43210': 'columbus, oh', '44114': 'cleveland, oh', '02108': 'boston, ma', '02445': 'brookline, ma', '79843': 'marfa, tx', '19103': 'philadelphia, pa', '01103': 'springfield, ma', '62701': 'springfield, il' };
  let key = requested.zip ? zipKeys[requested.zip] : `${normalizePlaceName(requested.city!)}, ${requested.state?.toLowerCase() ?? ''}`;
  if (!requested.state && normalizePlaceName(requested.city ?? '') === 'springfield') {
    if (!query.resolutionId) return { choices };
    if (!choices.some(c => c.id === query.resolutionId)) throw Error('That demo area choice is unavailable.');
    key = query.resolutionId;
  }
  const area = areas[key];
  if (!area) throw new Error('Demo fixtures cover Columbus, OH / 43210 and Cleveland, OH / 44114. Use a live search for other US areas.');
  const city = key.startsWith('columbus') ? 'Campus' : key.startsWith('cleveland') ? 'Cleveland' : area.city ?? key.split(',')[0];
  const base = { city: area.city ?? (key.startsWith('columbus') ? 'Columbus' : 'Cleveland'), state: area.state ?? 'OH', timeZone: area.timeZone, address: area.label + ' · synthetic location', lat: area.lat + .003, lon: area.lon, source: 'demo' as const, retrievedAt, price: unknownPrice, hours: unknownHours };
  const candidates: PlaceCandidate[] = [
    { ...base, id: key + '-walk', name: `Demo ${city} walk`, category: 'park', sourceUrl: 'https://example.com/fuzl-fixtures/' + key.split(',')[0] + '/walk', price: { amount: 0, currency: 'USD', basis: 'per-person', coverage: 'total' }, hours: { kind: 'date-specific', text: 'Synthetic test hours, not a real venue claim', date: '2026-11-14', start: '09:00', end: '20:00', timeZone: area.timeZone, closed: false } },
    { ...base, id: key + '-museum', name: `Demo ${city} museum`, category: 'museum', sourceUrl: 'https://example.com/fuzl-fixtures/' + key.split(',')[0] + '/museum', price: { amount: 40, currency: 'USD', basis: 'per-person', coverage: 'total' } },
    { ...base, id: key + '-bowling', name: `Demo ${city} bowling`, category: 'bowling', sourceUrl: 'https://example.com/fuzl-fixtures/' + key.split(',')[0] + '/bowling' },
  ];
  if (key === 'marfa, tx') {
    candidates.splice(1);
    candidates[0] = { ...candidates[0], id: 'demo-marfa-gallery', name: 'Demo Marfa gallery', category: 'museum', hours: unknownHours, price: unknownPrice };
    if (query.radiusKm >= 10) candidates.push({ ...candidates[0], id: 'demo-marfa-outskirts', name: 'Demo Marfa outskirts gallery', lat: area.lat + .06, sourceUrl: 'https://example.com/fuzl-fixtures/marfa/outskirts' });
  }
  if (key === 'philadelphia, pa') candidates[1] = { ...candidates[1], name: 'Demo Camden museum', city: 'Camden', state: 'NJ', lat: 39.942, lon: -75.122, address: 'Demo Camden, NJ · synthetic location' };
  if (key === 'boston, ma') candidates[1] = { ...candidates[1], name: 'Demo Cambridge museum', city: 'Cambridge', state: 'MA', lat: 42.365, lon: -71.09, address: 'Demo Cambridge, MA · synthetic location' };
  if (key === 'columbus, oh' && query.category === 'museum') {
    const recorded = [
      { name: 'University Museum', lat: 40.0006456, lon: -83.0144603, address: '281 West Lane Avenue, Columbus, OH 43210', alternative: '230 North Oval Mall, University Hall, Columbus, OH', url: 'https://alumnimagazine.osu.edu/story/our-collective-keepsakes' },
      { name: 'Museum of Classical Archaeology', lat: 40.0010711, lon: -83.0142055, address: '281 West Lane Avenue, Columbus, OH 43210', alternative: '028 Dulles Hall, Columbus, OH', url: 'https://moca.osu.edu/' },
      { name: 'Orton Geological Museum', lat: 39.998208, lon: -83.01192, address: '155 South Oval Mall, Columbus, OH 43210', alternative: null, url: 'https://ortonmuseum.osu.edu/' },
    ];
    return { area, candidates: recorded.map((row, index) => {
      const c: PlaceCandidate = { ...base, id: `recorded-columbus-${index}`, name: row.name, address: row.address, lat: row.lat, lon: row.lon, category: 'museum', sourceUrl: `https://www.openstreetmap.org/?mlat=${row.lat}&mlon=${row.lon}`, price: unknownPrice, hours: unknownHours };
      if (row.alternative) {
        const e = initialEvidence(c);
        e.claims.push({ id: `recorded-official-address-${index}`, field: 'address', value: { address: row.alternative, city: 'Columbus', state: 'OH', lat: null, lon: null, timeZone: 'America/New_York' }, source: { kind: 'official-page', url: row.url, checkedOn: '2026-11-07', verifiedForVenue: true } });
        c.evidence = e;
      }
      return c;
    }) };
  }
  return { area, candidates: candidates.filter(c => query.category === 'any' || query.category === c.category) };
}
