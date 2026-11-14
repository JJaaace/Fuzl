import { z } from 'zod';
import { savedSummarySchema, summaryReferencesValid } from './saved.js';
import { placeEvidence } from './place-evidence.js';
import { placeQuerySchema } from './places.js';
import { organizerDecisionSchema } from './organizer-decisions.js';
import { evaluatePlaces, attributed, current, settled } from './place-evaluation.js';
import { evaluateEvents } from './event-evaluation.js';
import { localInstant } from './place-location.js';
import { visitEvidenceSchema, retainedVisitChecks } from './visit-evidence.js';
import type { VisitWindow } from './visit-evidence.js';
import type { PlaceArea, PlaceCandidate, PlaceQuery, FitCheck } from './places.js';
import type { ScheduledEvent, EventQuery, EventCheck } from './events.js';
import type { PlanningSummary, PlanningFact } from './model.js';
import type { GroupMemory } from './memory.js';
import type { OrganizerDecision } from './organizer-decisions.js';

export type WorkCandidates = { kind: 'places'; area: PlaceArea; query: PlaceQuery; candidates: PlaceCandidate[] } | { kind: 'events'; area: PlaceArea; query: EventQuery; candidates: ScheduledEvent[] };
export const workEvidenceSchema = z.array(z.strictObject({ key: z.string().min(1).max(400), evidence: visitEvidenceSchema })).max(3).refine(v => new Set(v.map(e => e.key)).size === v.length);
export type WorkEvidence = z.infer<typeof workEvidenceSchema>;
export const workRequestSchema = z.strictObject({ snapshotId: z.string().uuid(), sessionRevision: z.number().int().positive(), summary: savedSummarySchema.refine(summaryReferencesValid), evidence: workEvidenceSchema });
export const workApplySchema = workRequestSchema.extend({ previewId: z.string().uuid(), suggestionId: z.string().max(160), approved: z.literal(true) });
export type WorkRequest = z.infer<typeof workRequestSchema>;
export const workApplyReplySchema = z.strictObject({ summary: savedSummarySchema.refine(summaryReferencesValid), query: placeQuerySchema.nullable(), decision: organizerDecisionSchema });
export type WorkApplyReply = z.infer<typeof workApplyReplySchema>;
export const workSuggestionSchema = z.strictObject({ id: z.string().max(160), kind: z.enum(['start-time', 'travel-limit']), factId: z.string(), delta: z.number().int(), before: z.string().max(300), after: z.string().max(300), fits: z.number().int().min(0).max(23), stillNeedsChecking: z.number().int().min(0).max(23), explanation: z.string().max(500), affected: z.array(z.strictObject({ key: z.string(), name: z.string(), state: z.enum(['fits', 'still-needs-checking']), remaining: z.array(z.string().max(700)).max(8) })).max(23) });
export type WorkSuggestion = z.infer<typeof workSuggestionSchema>;
export const workReportSchema = z.strictObject({ previewId: z.string().uuid().optional(), state: z.enum(['suggestions', 'no-adjustment', 'already-fits', 'private-checks']), message: z.string().max(600), suggestions: z.array(workSuggestionSchema).max(3), options: z.array(z.strictObject({ key: z.string(), name: z.string(), destination: z.string().nullable() })).max(23) });
export type WorkReport = z.infer<typeof workReportSchema>;
export const workKey = (c: Pick<PlaceCandidate | ScheduledEvent, 'source' | 'id'>) => `${c.source}:${c.id}`;
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const clock = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export function workWindow(c: WorkCandidates, summary: PlanningSummary): VisitWindow {
  if (c.kind === 'places') return { date: c.query.date, start: c.query.start, end: c.query.end, timeZone: c.query.timeZone };
  const group = summary.facts.filter(f => f.kind === 'schedule' && current(f) && settled(f) && f.strength === 'flexible' && f.subject.kind === 'group');
  const f = group.length === 1 ? group[0] : null;
  return f?.kind === 'schedule' ? { date: f.exactDate, start: f.startTime, end: f.endTime, timeZone: c.area.timeZone } : { date: null, start: null, end: null, timeZone: c.area.timeZone };
}
function availability(summary: PlanningSummary, window: VisitWindow) {
  if (!window.date || !window.start || !window.end || !window.timeZone || localInstant(window.date, window.start, window.timeZone) === null || localInstant(window.date, window.end, window.timeZone) === null) return { allowed: false, covered: false };
  const firm = summary.facts.filter(f => current(f) && f.kind === 'schedule' && f.strength === 'firm');
  const known = firm.filter(f => f.kind === 'schedule' && settled(f) && attributed(f, summary) && !!f.exactDate && !!f.startTime && !!f.endTime);
  const allowed = known.every(f => f.kind === 'schedule' && f.exactDate === window.date && f.startTime! <= window.start! && f.endTime! >= window.end!);
  const covered = known.length === firm.length && (known.some(f => f.subject.kind === 'group') || summary.participants.length > 0 && summary.participants.every(p => known.some(f => f.subject.kind === 'participant' && f.subject.participantId === p.id || f.subject.kind === 'speaker' && summary.speakers.some(s => s.id === (f.subject as { speakerId: string }).speakerId && s.participantId === p.id))));
  return { allowed, covered };
}
function withEvidence(c: WorkCandidates, evidence: WorkEvidence): WorkCandidates {
  return { ...c, candidates: c.candidates.map(v => ({ ...v, visit: { ...v.visit, ...evidence.find(e => e.key === workKey(v))?.evidence } })) } as WorkCandidates;
}
function assessments(c: WorkCandidates, summary: PlanningSummary, memories: GroupMemory[]) {
  return c.candidates.map(candidate => {
    const result = c.kind === 'places' ? evaluatePlaces([candidate as PlaceCandidate], c.area, c.query, summary, [], memories) : evaluateEvents([candidate as ScheduledEvent], c.area, c.query, summary, [], memories);
    const r = [...result.verified, ...result.promising, ...result.excluded][0];
    return { key: workKey(candidate), name: 'name' in candidate ? candidate.name : candidate.title, status: r.status, checks: r.checks as (FitCheck | EventCheck)[] };
  });
}
function values(f: PlanningFact, window: VisitWindow, delta: number) {
  if (f.kind === 'schedule') return { before: `${window.date} ${window.start}–${window.end} ${window.timeZone}`, after: `${window.date} ${clock(minutes(window.start!) + delta)}–${clock(minutes(window.end!) + delta)} ${window.timeZone}` };
  if (f.kind === 'travel') return { before: `${f.comparison === 'under' ? 'Under' : 'At most'} ${f.maxMinutes} min · ${f.mode}`, after: `${f.comparison === 'under' ? 'Under' : 'At most'} ${f.maxMinutes! + delta} min · ${f.mode}` };
  throw Error('Unsupported adjustment');
}
export function applyWorkChange(c: WorkCandidates, summary: PlanningSummary, s: Pick<WorkSuggestion, 'kind' | 'factId' | 'delta'>) {
  const next = structuredClone(summary), copy = structuredClone(c), f = next.facts.find(f => f.id === s.factId);
  if (!f || f.strength !== 'flexible' || !settled(f) || f.guest) throw Error('The explicitly flexible bound changed.');
  if (s.kind === 'start-time' && f.kind === 'schedule') {
    f.startTime = clock(minutes(f.startTime!) + s.delta); f.endTime = clock(minutes(f.endTime!) + s.delta);
    if (copy.kind === 'places') { copy.query.start = f.startTime; copy.query.end = f.endTime; }
  } else if (s.kind === 'travel-limit' && f.kind === 'travel') f.maxMinutes! += s.delta;
  else throw Error('Adjustment target changed.');
  return { context: copy, summary: next };
}
export function makeWork(context: WorkCandidates, summary: PlanningSummary, evidence: WorkEvidence = [], memories: GroupMemory[] = [], privateChecks = false): WorkReport {
  if (privateChecks) return { state: 'private-checks', message: 'Adjustment comparisons are withheld while private feasibility checks apply. No option counts, personal thresholds or individual explanations are returned. Confirm details directly without exposing private limits.', suggestions: [], options: [] };
  const seen = new Set<string>(), seenKeys = new Set<string>();
  const c = withEvidence({ ...context, candidates: context.candidates.filter(v => { const key = workKey(v); if (seen.has(v.sourceUrl) || seenKeys.has(key)) return false; seen.add(v.sourceUrl); seenKeys.add(key); return true; }).slice(0, 23).map(v => retainedVisitChecks(v, summary)) } as WorkCandidates, evidence);
  const options = c.candidates.map(v => ({ key: workKey(v), name: 'name' in v ? v.name : v.title, destination: 'name' in v ? placeEvidence(v).effective.address : v.venue.address }));
  const base = assessments(c, summary, memories);
  if (base.some(r => r.status === 'fits')) return { state: 'already-fits', message: 'An existing option already fits the checked constraints with these supplied details. Recheck the current cards; no relaxation is needed. Booking is still a separate check.', suggestions: [], options };
  const window = workWindow(c, summary), facts = summary.facts.filter(f => current(f) && settled(f) && attributed(f, summary) && f.strength === 'flexible' && f.subject.kind === 'group' && !f.guest);
  const time = facts.filter(f => f.kind === 'schedule' && f.exactDate === window.date && f.startTime === window.start && f.endTime === window.end);
  const travel = facts.filter(f => f.kind === 'travel' && f.maxMinutes !== null && f.mode && f.comparison !== 'unknown');
  const trials: { fact: PlanningFact; kind: WorkSuggestion['kind']; delta: number }[] = [];
  if (time.length === 1 && window.start && window.end && window.timeZone && window.timeZone === c.area.timeZone) for (let n = 1; n <= 60; n++) for (const delta of [-n, n]) if (minutes(window.start) + delta >= 0 && minutes(window.end) + delta < 1440) trials.push({ fact: time[0], kind: 'start-time', delta });
  if (travel.length === 1) for (let delta = 1; delta <= 10; delta++) trials.push({ fact: travel[0], kind: 'travel-limit', delta });
  const suggestions: WorkSuggestion[] = [];
  for (const t of trials) {
    const changed = applyWorkChange(c, summary, { factId: t.fact.id, kind: t.kind, delta: t.delta }), nextWindow = workWindow(changed.context, changed.summary), available = availability(summary, nextWindow);
    if (!available.allowed) continue; // Never offer a shift that excludes a supplied firm availability.
    const checked = assessments(changed.context, changed.summary, memories);
    const affected = checked.flatMap(r => {
      if (r.status === 'does-not-fit') return [];
      const old = base.find(b => b.key === r.key)!;
      const relevant = t.kind === 'start-time' ? 'timing' : 'travel';
      if (!old.checks.some(x => x.kind === relevant && x.status === 'does-not-fit') || r.checks.some(x => x.kind === relevant && x.status !== 'fits' && x.blocking !== false)) return [];
      const remaining = r.checks.filter(x => x.status !== 'fits' && (x.blocking !== false || x.kind === 'booking')).map(x => x.detail);
      if (!available.covered) remaining.push('Confirm availability for the intended group; unknown or unreviewed attendance/availability is not a verified fit.');
      return [{ key: r.key, name: r.name, state: remaining.length ? 'still-needs-checking' as const : 'fits' as const, remaining: remaining.slice(0, 8) }];
    });
    if (!affected.length) continue;
    const fits = affected.filter(r => r.state === 'fits').length;
    suggestions.push({ id: `${t.kind}:${t.fact.id}:${t.delta}`, kind: t.kind, factId: t.fact.id, delta: t.delta, ...values(t.fact, window, t.delta), fits, stillNeedsChecking: affected.length - fits, affected, explanation: `${t.kind === 'start-time' ? 'Shift the whole outing window, preserving its duration; the provider schedule stays fixed.' : 'Increase only the explicitly flexible travel bound; sourced travel duration stays fixed.'} All supplied firm availability remains within this window. Current budget, access and other firm checks remain in force.` });
  }
  suggestions.sort((a, b) => Number(b.fits > 0) - Number(a.fits > 0) || Math.abs(a.delta) - Math.abs(b.delta) || b.fits - a.fits || a.id.localeCompare(b.id));
  const signatures = new Set<string>(), useful = suggestions.filter(s => { const sig = JSON.stringify([s.kind, s.affected.map(a => [a.key, a.state])]); if (signatures.has(sig)) return false; signatures.add(sig); return true; }).slice(0, 3);
  const nextDetail = base.flatMap(r => r.checks).find(x => x.status === 'needs-checking' && ['budget', 'address', 'timing', 'travel', 'booking'].includes(x.kind))?.detail ?? (base.some(r => r.checks.some(x => x.kind === 'travel' && x.status === 'does-not-fit')) ? 'Confirm the sourced travel-time estimate or choose an option within every firm travel bound. A flexible change cannot override a firm limit.' : undefined);
  return { state: useful.length ? 'suggestions' : 'no-adjustment', message: useful.length ? 'Smallest supported single changes among these existing candidates, not a search for every possible plan. Preview each before explicitly applying it.' : `No supported single adjustment within ±60 minutes or +10 travel minutes makes a useful improvement. ${nextDetail ?? 'Confirm one group outing window or travel limit as explicitly flexible, with known values and confirmed availability.'}`, suggestions: useful, options };
}
export function recordWorkDecision(summary: PlanningSummary, s: WorkSuggestion, id: string, recordedAt: string, evidence: WorkEvidence = []): OrganizerDecision {
  return { id, kind: s.kind, factId: s.factId, before: s.before, after: s.after, sourceIds: summary.facts.find(f => f.id === s.factId)?.sourceIds ?? [], reason: 'Organizer explicitly applied a previewed single change. Original source text is unchanged; published plans and RSVPs require their own revision workflow.', recordedAt, checks: structuredClone(evidence.filter(e => s.affected.some(a => a.key === e.key))) };
}
