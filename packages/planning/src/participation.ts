import { localInstant } from './place-location.js';
import { participantForFact } from './guests.js';
import type { PlanningSummary, PlanningFact } from './model.js';
import { scopeWindowSchema } from './participation-contract.js';
import type { ParticipationScope, ScopeWindow, OptInChoice } from './participation-contract.js';
import type { FitCheck } from './places.js';
export function scopeWindowEnd(w: ScopeWindow) { const date = w.allDay ? new Date(Date.parse(w.date) + 86400000).toISOString().slice(0, 10) : w.date; return localInstant(date, w.allDay ? '00:00' : w.end, w.timeZone); }
export function windowWithin(inner: { date: string | null; start: string | null; end: string | null; timeZone: string | null }, outer: ScopeWindow) {
  if (!inner.date || !inner.start || !inner.end || !inner.timeZone) return null;
  const a = localInstant(inner.date, inner.start, inner.timeZone), b = localInstant(inner.date, inner.end, inner.timeZone), x = localInstant(outer.date, outer.start, outer.timeZone), y = scopeWindowEnd(outer);
  return a === null || b === null || x === null || y === null || b <= a ? null : a >= x && b <= y;
}
const current = (f: PlanningFact) => f.extraction?.scope !== 'historical';
const confirmed = (f: PlanningFact) => f.status === 'confirmed' && (!f.extraction || f.extraction.reviewed);
export function availabilityFor(summary: PlanningSummary, id: string, window: ScopeWindow | null, choice?: OptInChoice): ParticipationScope['roster'][number]['availability'] {
  if (choice === 'no') return 'unavailable';
  const facts = summary.facts.filter(f => current(f) && f.kind === 'schedule' && (participantForFact(f, summary) === id || f.subject.kind === 'group'));
  const firm = facts.filter(f => confirmed(f) && f.strength === 'firm');
  if (window && firm.some(f => f.kind === 'schedule' && f.exactDate && f.startTime && f.endTime && (f.exactDate !== window.date || window.start < f.startTime || window.end > f.endTime || window.allDay))) return 'conflicting';
  if (choice === 'yes') return 'confirmed';
  if (!window && firm.length) return 'confirmed';
  if (choice === 'tentative') return 'tentative';
  if (facts.some(f => f.status === 'conflicting')) return 'conflicting';
  if (window && firm.some(f => f.kind === 'schedule' && f.exactDate === window.date && f.startTime && f.endTime && f.startTime <= window.start && f.endTime >= window.end)) return 'confirmed';
  return facts.some(f => f.status === 'tentative' || !confirmed(f)) ? 'tentative' : 'missing';
}
// Temporary checking projection only. Never replace/save the organizer's summary.
// Unknown/group attribution remains in force; only clearly excluded people leave.
export function summaryForScope(summary: PlanningSummary, scope?: ParticipationScope): PlanningSummary {
  if (!scope || scope.mode === 'everyone') return summary;
  const excluded = new Set(scope.roster.filter(p => !p.selected).map(p => p.id));
  const removed = new Set(summary.facts.filter(f => excluded.has(participantForFact(f, summary) ?? '')).map(f => f.id));
  return { ...summary, facts: summary.facts.filter(f => !removed.has(f.id)), questions: summary.questions.filter(q => !q.relatedFactIds.length || !q.relatedFactIds.every(id => removed.has(id))).map(q => ({ ...q, relatedFactIds: q.relatedFactIds.filter(id => !removed.has(id)) })) };
}
export function participationChecks(scope: ParticipationScope | undefined, window: { date: string | null; start: string | null; end: string | null; timeZone: string | null }, summary?: PlanningSummary, referenceZone?: string | null): FitCheck[] {
  if (!scope) return [];
  let people = scope.roster.filter(p => p.selected), same = scope.window ? windowWithin(window, scope.window) : null;
  if (scope.mode === 'everyone' && scope.window && same !== true) {
    const priorStart = localInstant(scope.window.date, scope.window.start, scope.window.timeZone), priorEnd = scopeWindowEnd(scope.window);
    const start = window.date && window.start && window.timeZone ? localInstant(window.date, window.start, window.timeZone) : null;
    const end = window.date && window.end && window.timeZone ? localInstant(window.date, window.end, window.timeZone) : null;
    const outside = start !== null && priorEnd !== null && start >= priorEnd || end !== null && priorStart !== null && end <= priorStart || window.timeZone === scope.window.timeZone && !!window.date && window.date !== scope.window.date;
    if (outside) people = people.map(p => p.availability === 'unavailable' ? { ...p, availability: 'missing', evidence: 'unknown' } : p);
  }
  // Everyone mode may use current, explicitly confirmed availability facts for
  // a new known window. Never carry old-window guest opt-ins into that window.
  if (scope.mode === 'everyone' && same !== true && summary) {
    const exact = scopeWindowSchema.safeParse(window);
    if (exact.success) {
      const start = localInstant(exact.data.date, exact.data.start, exact.data.timeZone), end = scopeWindowEnd(exact.data);
      const priorStart = scope.window ? localInstant(scope.window.date, scope.window.start, scope.window.timeZone) : null, priorEnd = scope.window ? scopeWindowEnd(scope.window) : null;
      const overlaps = start !== null && end !== null && priorStart !== null && priorEnd !== null && start < priorEnd && end > priorStart;
      people = people.map(p => ({ ...p, evidence: overlaps && ['unavailable', 'conflicting'].includes(p.availability) ? p.evidence : 'planning-fact', availability: overlaps && ['unavailable', 'conflicting'].includes(p.availability) ? p.availability : availabilityFor(summary, p.id, exact.data) })); same = true;
    }
  }
  const checks: FitCheck[] = [];
  if (!people.length) checks.push({ kind: 'constraint', status: 'needs-checking', detail: 'The intended roster is missing. Add the intended participants before checking a full-group fit.' });
  if (scope.mode === 'available') checks.push({ kind: 'timing', status: !scope.reviewed || same === null ? 'needs-checking' : same ? 'fits' : 'does-not-fit', detail: 'Explicit opt-ins apply only within the reviewed session window. A different window needs new opt-ins and a fresh review.' });
  for (const p of people) checks.push({ kind: 'timing', status: p.availability === 'unavailable' || p.availability === 'conflicting' ? 'does-not-fit' : p.availability === 'confirmed' && same === true && (p.evidence !== 'planning-fact' || !!referenceZone && window.timeZone === referenceZone) ? 'fits' : 'needs-checking', detail: p.availability === 'unavailable' ? 'An intended attendee explicitly reported unavailable for this window.' : p.availability === 'conflicting' ? 'An intended attendee has conflicting availability; an opt-in cannot waive a firm time limit.' : p.availability === 'tentative' ? 'An intended attendee has tentative availability, not a confirmed opt-in.' : p.availability === 'missing' ? 'An intended attendee has not confirmed availability. A missing reply stays unknown.' : same === true && (p.evidence !== 'planning-fact' || !!referenceZone && window.timeZone === referenceZone) ? 'Confirmed availability covers this exact session window.' : 'Confirm a reliable time window for every intended attendee; another date or unknown clock is not covered.' });
  return checks;
}
