import { z } from 'zod';
import type { PlanningFact, PlanningSummary } from './model.js';
import type { FitCheck } from './places.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const zone = z.string().max(80).refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } });
const source = {
  destination: z.string().trim().min(1).max(800),
  checkedOn: date.refine(v => v <= new Date().toISOString().slice(0, 10)),
  sourceUrl: z.string().url().max(1000).refine(v => { try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && ![...u.searchParams.keys()].some(k => /key|token|secret|authorization|invite/i.test(k)) && !/token=|invite=/i.test(u.hash); } catch { return false; } }),
};
export const travelEstimateSchema = z.strictObject({ ...source, minutes: z.number().int().min(0).max(480), mode: z.enum(['driving', 'walking', 'cycling', 'transit']), origin: z.string().trim().min(1).max(160), commonOriginConfirmed: z.literal(true), date, arrival: clock, timeZone: zone });
export const bookingEvidenceSchema = z.strictObject({ ...source, state: z.enum(['not-required', 'available', 'unavailable']), date, start: clock, end: clock, timeZone: zone }).refine(v => v.end > v.start);
export const visitEvidenceSchema = z.strictObject({ travel: travelEstimateSchema.optional(), booking: bookingEvidenceSchema.optional() });
export type VisitEvidence = z.infer<typeof visitEvidenceSchema>;
export function retainedVisitChecks<T extends { source: string; id: string; visit?: VisitEvidence }>(candidate: T, summary: PlanningSummary): T {
  const key = `${candidate.source}:${candidate.id}`;
  const recorded = summary.organizerDecisions?.flatMap(d => d.checks ?? []).filter(e => e.key === key);
  return recorded?.length ? { ...candidate, visit: { ...Object.assign({}, ...recorded.map(e => e.evidence)) as VisitEvidence, ...candidate.visit } } : candidate;
}
export interface VisitWindow { date: string | null; start: string | null; end: string | null; timeZone: string | null }
export function travelMode(v: string | null) { const n = v?.trim().toLowerCase(); return n === 'drive' || n === 'car' ? 'driving' : n === 'walk' ? 'walking' : n === 'bike' || n === 'biking' ? 'cycling' : n; }
export function travelCheck(f: Extract<PlanningFact, { kind: 'travel' }>, evidence: VisitEvidence | undefined, window: VisitWindow, destination: string | null): FitCheck {
  const e = evidence?.travel;
  const usable = !!e && !!destination && e.destination === destination && e.date === window.date && e.arrival === window.start && e.timeZone === window.timeZone && travelMode(f.mode) === e.mode && f.maxMinutes !== null && f.comparison !== 'unknown';
  return { kind: 'travel', status: !usable ? 'needs-checking' : (f.comparison === 'under' ? e.minutes < f.maxMinutes! : e.minutes <= f.maxMinutes!) ? 'fits' : 'does-not-fit', detail: !usable ? 'Confirm a sourced travel-time estimate for this address, date, arrival clock, mode and a shared origin explicitly used by everyone. Radius is insufficient.' : 'Compared the organizer-recorded shared-origin estimate with the current travel limit. It is an estimate, not a guaranteed journey duration.' };
}
export function bookingCheck(evidence: VisitEvidence | undefined, window: VisitWindow, destination: string | null): FitCheck {
  const b = evidence?.booking;
  const usable = !!b && !!destination && b.destination === destination && b.date === window.date && b.timeZone === window.timeZone && !!window.start && !!window.end && b.start <= window.start && b.end >= window.end;
  return { kind: 'booking', status: !usable ? 'needs-checking' : b.state === 'unavailable' ? 'does-not-fit' : 'fits', blocking: usable && b.state === 'unavailable', detail: !usable ? 'Ticket, booking or group access availability remains unverified for this exact window.' : b.state === 'not-required' ? 'Organizer recorded that tickets/booking are not required for this group and window; recheck the supplied source.' : b.state === 'available' ? 'Organizer recorded group availability from the supplied source; this does not create a booking.' : 'The supplied group booking/access check says unavailable for this window.' };
}
