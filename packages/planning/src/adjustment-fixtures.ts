import { demoPlaces, demoPlaceQuery, demoPlaceSummary } from './place-fixtures.js';
import { demoEvents } from './event-fixtures.js';
import type { WorkCandidates } from './adjustments.js';
import type { PlanningSummary } from './model.js';
import type { GroupMemory } from './memory.js';
export const workCases = ['time', 'travel', 'radius-only', 'firm-travel', 'events'] as const;
export type WorkCase = typeof workCases[number];
// Synthetic, manually authored cases. No provider or AI analysis.
export function workFixture(kind: WorkCase = 'time'): { context: WorkCandidates; summary: PlanningSummary; memories: GroupMemory[] } {
  const query = { ...demoPlaceQuery, start: '19:00', end: '20:00' }, found = demoPlaces(query, '2026-11-14T12:00:00.000Z'); if (!('area' in found)) throw Error('Fixture area');
  const summary = demoPlaceSummary(); summary.participants = [{ id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }];
  summary.speakers = [{ id: 'chat', label: 'Synthetic group conversation', participantId: null }];
  summary.sources = [{ id: 'preferred', speakerId: 'chat', text: 'We prefer 7–8pm, but the start is flexible.' }, { id: 'available', speakerId: 'chat', text: 'Alex and Sam confirmed 6:30–9pm on November 14.' }];
  summary.facts.push({ id: 'flex-window', kind: 'schedule', subject: { kind: 'group' }, status: 'confirmed', strength: 'flexible', sourceIds: ['preferred'], description: 'Preferred outing window; organizer may adjust', exactDate: query.date, startTime: query.start, endTime: query.end });
  for (const p of summary.participants) summary.facts.push({ id: `${p.id}-availability`, kind: 'schedule', subject: { kind: 'participant', participantId: p.id }, status: 'confirmed', strength: 'firm', sourceIds: ['available'], description: 'Confirmed availability', exactDate: query.date, startTime: '18:30', endTime: '21:00' });
  const candidates = [0, 1, 2].map((i) => {
    const c = structuredClone(found.candidates[0]); c.id = `work-${i}`; c.name = ['Synthetic sunset walk', 'Synthetic early gate (would exclude someone)', 'Synthetic garden (price unknown)'][i]; c.sourceUrl = `https://example.com/fuzl-work/${i}`;
    c.hours = { ...c.hours, start: '18:00', end: i === 1 ? '19:00' : '19:30' };
    if (i === 2) c.price = { amount: null, currency: null, coverage: 'unknown', basis: 'unknown' };
    c.visit = { booking: { state: 'not-required', destination: c.address!, date: query.date!, start: '18:00', end: '21:00', timeZone: query.timeZone!, checkedOn: '2026-11-07', sourceUrl: c.sourceUrl } };
    return c;
  });
  const memories: GroupMemory[] = [{ sourceUrl: candidates[1].sourceUrl, takeaway: 'The group enjoyed a previous visit. Current availability still rules.', sentiment: 'positive', date: '2026-11-07' }];
  if (kind === 'events') {
    const q = { area: query.area, radiusKm: query.radiusKm, from: query.date!, to: query.date! }, events = demoEvents(q, '2026-11-14T12:00:00.000Z'); if (!('events' in events)) throw Error('Fixture events');
    const e = events.events[0]; e.title = 'Synthetic fixed 18:30 performance'; e.schedule = { ...e.schedule, time: '18:30', endTime: '19:30', utcStart: null }; e.visit = { booking: { ...candidates[0].visit!.booking!, destination: e.venue.address! } };
    return { context: { kind: 'events', area: events.area, query: q, candidates: [e] }, summary, memories: [] };
  }
  if (kind !== 'time') {
    candidates.splice(1); candidates[0].hours.end = '21:00';
    summary.facts.push({ id: 'flex-travel', kind: 'travel', subject: { kind: 'group' }, status: 'confirmed', strength: 'flexible', sourceIds: [], maxMinutes: 20, comparison: 'at-most', mode: 'driving' });
    summary.facts.push({ id: 'firm-travel', kind: 'travel', subject: { kind: 'group' }, status: 'confirmed', strength: 'firm', sourceIds: [], maxMinutes: kind === 'firm-travel' ? 25 : 30, comparison: 'at-most', mode: 'driving' });
    if (kind !== 'radius-only') candidates[0].visit!.travel = { minutes: 26, mode: 'driving', origin: 'Synthetic shared meeting point', commonOriginConfirmed: true, destination: candidates[0].address!, date: query.date!, arrival: query.start!, timeZone: query.timeZone!, checkedOn: '2026-11-07', sourceUrl: 'https://example.com/fuzl-work/route-estimate' };
  }
  return { context: { kind: 'places', area: found.area, query, candidates }, summary, memories };
}
