import { emptySummary } from './model.js';
import type { PlanningSummary } from './model.js';
import { unknownHours, unknownPrice } from './places.js';
import type { PlaceArea, PlaceCandidate, PlaceQuery } from './places.js';
// Hand-authored synthetic places, not provider analysis or verified real venues.
const areas: Record<string, PlaceArea> = {
  'columbus, oh': { label: 'Demo Columbus / Ohio State area', lat: 40.0017, lon: -83.0197, timeZone: 'America/New_York' },
  'cleveland, oh': { label: 'Demo Cleveland area', lat: 41.4993, lon: -81.6944, timeZone: 'America/New_York' },
};
export const demoPlaceQuery: PlaceQuery = { area: 'Columbus, OH', radiusKm: 5, category: 'any', date: '2026-11-14', start: '15:00', end: '17:00', timeZone: 'America/New_York' };
export function demoPlaceSummary(): PlanningSummary {
  return { ...emptySummary(), facts: [
    { id: 'demo-budget', kind: 'budget', subject: { kind: 'group' }, status: 'confirmed', strength: 'firm', sourceIds: [], amount: 20, currency: 'USD' },
    { id: 'demo-activity', kind: 'activity', subject: { kind: 'group' }, status: 'confirmed', strength: 'flexible', sourceIds: [], description: 'park' },
  ] };
}
export function demoPlaces(query: PlaceQuery, retrievedAt: string): { area: PlaceArea; candidates: PlaceCandidate[] } {
  const normalized = query.area.toLowerCase().replace(/\s+/g, ' ').replace(/,\s*/, ', ').trim();
  const key = ['43210', 'columbus, ohio'].includes(normalized) ? 'columbus, oh' : ['44114', 'cleveland, ohio'].includes(normalized) ? 'cleveland, oh' : normalized;
  const area = areas[key];
  if (!area) throw new Error('Demo fixtures cover Columbus, OH / 43210 and Cleveland, OH / 44114. Use a live search for other US areas.');
  const city = key.startsWith('columbus') ? 'Campus' : 'Cleveland';
  const base = { address: area.label + ' · synthetic location', lat: area.lat + .003, lon: area.lon, source: 'demo' as const, retrievedAt, price: unknownPrice, hours: unknownHours };
  const candidates: PlaceCandidate[] = [
    { ...base, id: key + '-walk', name: `Demo ${city} walk`, category: 'park', sourceUrl: 'https://example.com/fuzl-fixtures/' + key.split(',')[0] + '/walk', price: { amount: 0, currency: 'USD', basis: 'per-person', coverage: 'total' }, hours: { kind: 'date-specific', text: 'Synthetic test hours, not a real venue claim', date: '2026-11-14', start: '09:00', end: '20:00', timeZone: 'America/New_York', closed: false } },
    { ...base, id: key + '-museum', name: `Demo ${city} museum`, category: 'museum', sourceUrl: 'https://example.com/fuzl-fixtures/' + key.split(',')[0] + '/museum', price: { amount: 40, currency: 'USD', basis: 'per-person', coverage: 'total' } },
    { ...base, id: key + '-bowling', name: `Demo ${city} bowling`, category: 'bowling', sourceUrl: 'https://example.com/fuzl-fixtures/' + key.split(',')[0] + '/bowling' },
  ];
  return { area, candidates: candidates.filter(c => query.category === 'any' || query.category === c.category) };
}
