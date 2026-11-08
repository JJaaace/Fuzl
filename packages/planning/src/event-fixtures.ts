import { demoPlaces } from './place-fixtures.js';
import type { AreaChoice, PlaceArea } from './places.js';
import type { EventQuery, ScheduledEvent } from './events.js';
// Fixed, manually authored synthetic events. Search controls never shift fixture
// dates to manufacture matches. example.com links are deliberately not tickets.
export function demoEvents(query: EventQuery, retrievedAt: string): { choices: AreaChoice[] } | { area: PlaceArea; events: ScheduledEvent[] } {
  const found = demoPlaces({ area: query.area, resolutionId: query.resolutionId, radiusKm: query.radiusKm, category: 'any', date: null, start: null, end: null, timeZone: null }, retrievedAt);
  if ('choices' in found) return found;
  const { area } = found;
  const base: ScheduledEvent = {
    id: 'fitting', title: 'Demo afternoon concert', source: 'demo', sourceUrl: 'https://example.com/fuzl-fixtures/events/fitting', retrievedAt, providerStatus: 'scheduled',
    venue: { name: 'Demo neighborhood hall', address: `${area.label} · synthetic address`, city: area.city ?? found.candidates[0]?.city ?? null, state: area.state ?? found.candidates[0]?.state ?? null, lat: area.lat + .003, lon: area.lon },
    schedule: { date: '2026-11-14', time: '15:00', endDate: '2026-11-14', endTime: '16:00', timeZone: area.timeZone, utcStart: null, dateUncertain: false, timeUncertain: false, zoneConflict: false },
    price: { amount: 10, currency: 'USD', kind: 'total', basis: 'per-person', fees: 'included' },
  };
  const variant = (id: string, title: string, overrides: Partial<ScheduledEvent> = {}): ScheduledEvent => ({ ...base, id, title, sourceUrl: `https://example.com/fuzl-fixtures/events/${id}`, ...overrides });
  let events = [base,
    variant('starting', 'Demo evening showcase — starting price', { price: { ...base.price, amount: 8, kind: 'starting', fees: 'unknown' } }),
    variant('date-only', 'Demo community festival — date only', { schedule: { ...base.schedule, time: null, endTime: null, timeUncertain: true }, price: { ...base.price, amount: null, currency: null, kind: 'unknown', basis: 'unknown', fees: 'unknown' } }),
    variant('outside', 'Demo concert outside search dates', { schedule: { ...base.schedule, date: '2026-11-21', endDate: '2026-11-21' } }),
    variant('cancelled', 'Demo cancelled concert', { providerStatus: 'cancelled' }),
    variant('postponed', 'Demo postponed concert', { providerStatus: 'postponed', schedule: { ...base.schedule, dateUncertain: true } }),
    variant('rescheduled', 'Demo rescheduled concert', { providerStatus: 'rescheduled' }),
  ];
  if (area.postcode === '79843') events = [events[1]];
  // Simulate a provider filtering by dates, retaining uncertain and intentionally
  // out-of-range records so deterministic exclusions are visible in the demo.
  if (query.to < '2026-11-14' || query.from > '2026-11-21') events = [];
  return { area, events };
}
