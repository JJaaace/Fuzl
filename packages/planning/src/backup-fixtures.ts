import { emptySummary } from './model.js';
import type { PlanningSummary } from './model.js';
import { detailsFromOption } from './plans.js';
import type { BallotOption } from './ballots.js';
import type { ParticipationScope } from './participation-contract.js';
export function backupFixture() {
  const date = '2026-11-21', timeZone = 'America/New_York';
  const outdoor: BallotOption = { id: '00000000-0000-4000-8000-000000000601', kind: 'place', name: 'Synthetic outdoor picnic', location: 'Synthetic park north gate', time: null, cost: { amount: 0, currency: 'USD', kind: 'total', basis: 'per-person' }, links: [{ label: 'Example picnic source', url: 'https://example.com/synthetic-picnic' }], unresolved: ['Check weather deliberately; no monitoring is enabled'], sample: true };
  const indoor: BallotOption = { ...outdoor, id: '00000000-0000-4000-8000-000000000602', kind: 'idea', name: 'Synthetic indoor games', location: 'Synthetic community room lobby', cost: { amount: null, currency: null, kind: 'unknown', basis: 'unknown' }, links: [{ label: 'Example indoor source', url: 'https://example.com/synthetic-games' }], unresolved: ['Room price and opening hours unknown', 'Check step-free access'] };
  const summary: PlanningSummary = { ...emptySummary(), participants: [{ id: 'a', name: 'Avery' }, { id: 'b', name: 'Blake' }], facts: [ { id: 'availability', kind: 'schedule', subject: { kind: 'group' }, sourceIds: [], status: 'confirmed', strength: 'firm', description: 'Reviewed local availability', exactDate: date, startTime: '18:00', endTime: '22:00' }, { id: 'budget', kind: 'budget', subject: { kind: 'group' }, sourceIds: [], status: 'confirmed', strength: 'firm', amount: 20, currency: 'USD' } ], questions: [{ id: 'question', kind: 'missing', text: 'Do we need to book the room?', relatedFactIds: [], resolution: null }] };
  const scope: ParticipationScope = { mode: 'everyone', attendeeCount: 2, roster: summary.participants.map(p => ({ ...p, availability: 'confirmed', selected: true, evidence: 'planning-fact' })), window: { date, start: '18:00', end: '22:00', timeZone }, reviewed: true, expiresAt: null, key: 'a'.repeat(64) };
  const details = { ...detailsFromOption(indoor), date, time: '19:00', timeZone };
  return { outdoor, indoor, summary, scope, details, endTime: '20:30', availabilityTimeZone: timeZone };
}
