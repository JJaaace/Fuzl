import type { FactStatus, PlanningSummary, SampleExample, SourceText, Strength, Subject } from './model';

// All interpretations below are hand-authored fixtures, never parsed from text.
const speaker = (speakerId: string): Subject => ({ kind: 'speaker', speakerId });
function meta(id: string, speakerId: string, status: FactStatus, strength: Strength, ...sourceIds: string[]) {
  return { id, subject: speaker(speakerId), status, strength, sourceIds };
}
function people(names: string[]) {
  return {
    participants: names.map((name, index) => ({ id: `p${index}`, name })),
    speakers: names.map((label, index) => ({ id: `s${index}`, label, participantId: `p${index}` })),
  };
}
function example(id: string, title: string, description: string, summary: PlanningSummary): SampleExample {
  return { id, title, description, conversation: summary.sources.map((source) => source.text).join('\n'), summary };
}
function source(id: string, speakerId: string, text: string): SourceText { return { id, speakerId, text }; }

const straightforward = example('straightforward', 'Straightforward plan', 'Explicit dates, individual limits, and an unbooked activity idea.', {
  ...people(['Alex', 'Sam']),
  sources: [
    source('a1', 's0', 'Alex: Saturday, November 14, 2026, from 18:00 to 20:00 works for me. Bowling could be fun; nothing is booked.'),
    source('a2', 's1', 'Sam: That date and time work for me too. My limit is USD 20 per person. I need a drive of at most 20 minutes.'),
    source('a3', 's0', "Alex: My limit is USD 25 per person and a drive of at most 20 minutes. I'd prefer somewhere quiet, but that is flexible."),
  ],
  facts: [
    { ...meta('a-date', 's0', 'confirmed', 'firm', 'a1'), kind: 'schedule', description: 'Saturday evening availability', exactDate: '2026-11-14', startTime: '18:00', endTime: '20:00' },
    { ...meta('s-date', 's1', 'confirmed', 'firm', 'a1', 'a2'), kind: 'schedule', description: 'Same Saturday evening availability', exactDate: '2026-11-14', startTime: '18:00', endTime: '20:00' },
    { ...meta('a-budget', 's0', 'confirmed', 'firm', 'a3'), kind: 'budget', amount: 25, currency: 'USD' },
    { ...meta('s-budget', 's1', 'confirmed', 'firm', 'a2'), kind: 'budget', amount: 20, currency: 'USD' },
    { ...meta('a-travel', 's0', 'confirmed', 'firm', 'a3'), kind: 'travel', maxMinutes: 20, comparison: 'at-most', mode: 'Driving' },
    { ...meta('s-travel', 's1', 'confirmed', 'firm', 'a2'), kind: 'travel', maxMinutes: 20, comparison: 'at-most', mode: 'Driving' },
    { ...meta('a-activity', 's0', 'proposed', 'flexible', 'a1'), kind: 'activity', description: 'Bowling — idea only, not booked' },
    { ...meta('a-preference', 's0', 'confirmed', 'flexible', 'a3'), kind: 'preference', description: 'Somewhere quiet' },
  ],
  questions: [],
});

const tentative = example('tentative', 'Missing & tentative details', 'The original Foundation sample: “maybe” stays tentative and Friday has no exact date.', {
  ...people(['Alex', 'Sam', 'Jordan']),
  sources: [
    source('b1', 's0', 'Alex: Anyone free this Friday evening?'),
    source('b2', 's1', 'Sam: Maybe after 7. I can spend up to $20.'),
    source('b3', 's2', "Jordan: I'd like to try something new, but keep the drive under 20 minutes."),
    source('b4', 's0', 'Alex: Bowling could be fun. Nothing is booked yet.'),
  ],
  facts: [
    { ...meta('b-date', 's0', 'proposed', 'flexible', 'b1'), kind: 'schedule', description: 'This Friday evening; reference date unknown', exactDate: null, startTime: null, endTime: null },
    { ...meta('b-time', 's1', 'tentative', 'unknown', 'b1', 'b2'), kind: 'schedule', description: 'Maybe after 7; AM/PM and exact date need confirmation', exactDate: null, startTime: null, endTime: null },
    { ...meta('b-sbudget', 's1', 'confirmed', 'firm', 'b2'), kind: 'budget', amount: 20, currency: null },
    { ...meta('b-abudget', 's0', 'proposed', 'unknown'), kind: 'budget', amount: null, currency: null },
    { ...meta('b-jbudget', 's2', 'proposed', 'unknown'), kind: 'budget', amount: null, currency: null },
    { ...meta('b-travel', 's2', 'confirmed', 'firm', 'b3'), kind: 'travel', maxMinutes: 20, comparison: 'under', mode: 'Driving' },
    { ...meta('b-new', 's2', 'confirmed', 'flexible', 'b3'), kind: 'preference', description: 'Try something new' },
    { ...meta('b-activity', 's0', 'proposed', 'flexible', 'b4'), kind: 'activity', description: 'Bowling — idea only, not booked' },
  ],
  questions: [
    { id: 'bq1', kind: 'missing', text: 'Which exact Friday, and what time window? Is Sam available, and does “7” mean evening?', relatedFactIds: ['b-date', 'b-time'], resolution: null },
    { id: 'bq2', kind: 'missing', text: 'What currency is Sam’s $20? What are Alex’s and Jordan’s individual budgets?', relatedFactIds: ['b-sbudget', 'b-abudget', 'b-jbudget'], resolution: null },
    { id: 'bq3', kind: 'missing', text: 'When is Jordan available, and what are Alex’s and Sam’s travel limits?', relatedFactIds: [], resolution: null },
  ],
});

const conflicts = example('conflicts', 'Conflicts & a correction', 'Opposing preferences and a corrected spending limit remain visible for review.', {
  ...people(['Maya', 'Leo', 'Ren']),
  sources: [
    source('c1', 's0', 'Maya: I need an indoor activity. Outdoor activities will not work for me.'),
    source('c2', 's1', 'Leo: I only want an outdoor hike. Indoors will not work for me.'),
    source('c3', 's2', 'Ren: I can spend USD 30 per person.'),
    source('c4', 's2', 'Ren: Correction: my limit is USD 15, not USD 30.'),
    source('c5', 's0', 'Maya: Maybe Saturday afternoon? We have not picked an exact date or time.'),
  ],
  facts: [
    { ...meta('c-indoor', 's0', 'conflicting', 'firm', 'c1'), kind: 'preference', description: 'Indoor activity required; conflicts with Leo’s requirement' },
    { ...meta('c-outdoor', 's1', 'conflicting', 'firm', 'c2'), kind: 'preference', description: 'Outdoor hike required; conflicts with Maya’s requirement' },
    { ...meta('c-budget', 's2', 'confirmed', 'firm', 'c3', 'c4'), kind: 'budget', amount: 15, currency: 'USD' },
    { ...meta('c-date', 's0', 'tentative', 'flexible', 'c5'), kind: 'schedule', description: 'Maybe Saturday afternoon; exact date and time unknown', exactDate: null, startTime: null, endTime: null },
    { ...meta('c-activity', 's1', 'proposed', 'firm', 'c2'), kind: 'activity', description: 'Outdoor hike — idea only; conflicts with indoor requirement' },
  ],
  questions: [
    { id: 'cq1', kind: 'conflict', text: 'Maya needs indoors and Leo requires outdoors. Ask whether either requirement can change; no compromise is agreed.', relatedFactIds: ['c-indoor', 'c-outdoor', 'c-activity'], resolution: null },
    { id: 'cq2', kind: 'missing', text: 'Confirm the exact date, individual time windows, remaining budgets, and travel limits.', relatedFactIds: ['c-date'], resolution: null },
    { id: 'cq3', kind: 'conflict', text: 'Ren first said USD 30, then corrected the limit to USD 15.', relatedFactIds: ['c-budget'], resolution: 'Manually authored fixture uses Ren’s later explicit correction: USD 15. The original text is retained as evidence.' },
  ],
});

export const examples: SampleExample[] = [straightforward, tentative, conflicts];
