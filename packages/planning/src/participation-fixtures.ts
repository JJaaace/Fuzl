import { demoPlaces, demoPlaceQuery } from './place-fixtures.js';
import { emptySummary } from './model.js';
import type { PlanningSummary } from './model.js';
import type { ScopeWindow } from './participation-contract.js';
export function participationFixture() {
  const found = demoPlaces(demoPlaceQuery, '2026-11-14T12:00:00.000Z'); if (!('area' in found)) throw Error('Fixture area');
  const window: ScopeWindow = { date: '2026-11-14', start: '19:00', end: '21:00', timeZone: 'America/New_York' };
  const summary: PlanningSummary = { ...emptySummary(), participants: ['Avery', 'Blake', 'Casey', 'Devon', 'Elliot', 'Frankie'].map((name, i) => ({ id: `person-${i + 1}`, name })), facts: [] };
  summary.facts = summary.participants.flatMap((p, i) => [
    { id: `budget-${p.id}`, kind: 'budget' as const, subject: { kind: 'participant' as const, participantId: p.id }, status: 'confirmed' as const, strength: 'firm' as const, sourceIds: [], amount: [25, 20, 18, 15, 8, 5][i], currency: 'USD' },
    { id: `travel-${p.id}`, kind: 'travel' as const, subject: { kind: 'participant' as const, participantId: p.id }, status: 'confirmed' as const, strength: 'firm' as const, sourceIds: [], maxMinutes: 20, comparison: 'at-most' as const, mode: 'walking' },
  ]);
  const candidate = { ...found.candidates[0], id: 'six-person-outing', name: 'Synthetic evening garden', price: { amount: 12, currency: 'USD', basis: 'per-person' as const, coverage: 'total' as const }, hours: { ...found.candidates[0].hours, start: '18:00', end: '22:00' }, visit: { travel: { destination: found.candidates[0].address!, checkedOn: window.date, sourceUrl: 'https://example.com/synthetic-route', minutes: 12, mode: 'walking' as const, origin: 'Synthetic shared station', commonOriginConfirmed: true as const, date: window.date, arrival: window.start, timeZone: window.timeZone }, booking: { destination: found.candidates[0].address!, checkedOn: window.date, sourceUrl: 'https://example.com/synthetic-access', state: 'not-required' as const, ...window } } };
  return { summary, window, query: { ...demoPlaceQuery, ...window }, area: found.area, candidate };
}
