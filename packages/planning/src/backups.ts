import { travelCheck, travelMode } from './visit-evidence.js';
import { travelLimitChecks } from './travel-balance.js';
import type { TravelContext } from './travel-balance.js';
import { z } from 'zod';
import { ballotOptionSchema } from './ballots.js';
import { planDetailsSchema, planDraftSchema, planMutationBase, publishedDetailsSchema, publicPlanSchema } from './plans.js';
import { clockSchema, zoneSchema, fitCheckSchema, unknownHours } from './places.js';
import { scopeResultSchema } from './participation-contract.js';
import type { ParticipationScope } from './participation-contract.js';
import type { PlanningSummary } from './model.js';
import type { PlanDetails } from './plans.js';
import { assessPlaces, attributed, budgetCheck, current, settled } from './place-evaluation.js';
import type { PrivateSpending } from './place-evaluation.js';
import { localInstant } from './place-location.js';
const endTime = clockSchema.nullable();
// Reserve room in the public replacement for carried source and computed checks.
const authoredDetails = publishedDetailsSchema.safeExtend({ unresolved: planDetailsSchema.shape.unresolved.max(16) });
export const backupRecordSchema = z.strictObject({ usedAtVersion: z.number().int().positive().nullable(), id: z.string().uuid(), revision: z.number().int().positive(), origin: z.enum(['manual', 'shortlist']), shortlistRevision: z.number().int().positive().nullable(), option: ballotOptionSchema, details: authoredDetails, endTime, availabilityTimeZone: zoneSchema.nullable(), privateNote: z.string().trim().max(500) });
export type PlanBackup = z.infer<typeof backupRecordSchema>;
export const backupSaveSchema = z.strictObject({ ...planMutationBase, sessionRevision: z.number().int().positive(), backupRevision: z.number().int().min(0), source: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('manual') }), z.strictObject({ kind: z.literal('shortlist'), optionId: z.string().uuid(), shortlistRevision: z.number().int().positive() })]), details: authoredDetails, endTime, availabilityTimeZone: zoneSchema.nullable(), privateNote: z.string().trim().max(500) }).refine(v => (!v.endTime || v.endTime > v.details.time!) && (v.details.endTime == null || v.details.endTime === v.endTime) && publishedDetailsSchema.safeParse({ ...v.details, endTime: v.endTime }).success, 'Use a same-day end after the start or leave duration unknown.');
export const backupAssessmentSchema = z.strictObject({ status: z.enum(['fits', 'needs-checking', 'does-not-fit']), checks: z.array(fitCheckSchema).max(220), scope: scopeResultSchema, checkedAt: z.string().datetime() });
export type BackupAssessment = z.infer<typeof backupAssessmentSchema>;
const previewInput = { revision: z.number().int().positive(), backupRevision: z.number().int().positive(), sessionRevision: z.number().int().positive(), notice: z.string().trim().min(8).max(350) };
export const backupPreviewInputSchema = z.strictObject(previewInput);
export const backupSwitchSchema = z.strictObject({ ...previewInput, requestId: z.string().uuid(), previewKey: z.string().regex(/^[a-f0-9]{64}$/), approved: z.literal(true), acknowledgeUnknowns: z.literal(true) });
export const backupPreviewSchema = z.strictObject({ previewKey: z.string().regex(/^[a-f0-9]{64}$/), revision: previewInput.revision, backupRevision: previewInput.backupRevision, sessionRevision: previewInput.sessionRevision, current: publicPlanSchema.omit({ expiresAt: true }), replacement: planDraftSchema, assessment: backupAssessmentSchema, notice: z.string().max(500) });
export type BackupPreview = z.infer<typeof backupPreviewSchema>;
export const backupDashboardSchema = z.strictObject({ message: z.string().max(350).optional(), backup: backupRecordSchema.nullable(), assessment: backupAssessmentSchema.nullable() });
export type BackupDashboard = z.infer<typeof backupDashboardSchema>;
// A shortlist is a public snapshot, not fresh venue evidence. Never infer clocks
// from its prose, coordinates from an address, or hours/travel from a link.
export function assessBackup(backup: PlanBackup, summary: PlanningSummary, scope: ParticipationScope, spending: PrivateSpending[], now: number, travel?: TravelContext): BackupAssessment {
  const d = backup.details;
  const availabilityZone = backup.availabilityTimeZone ?? (scope.mode === 'available' ? scope.window?.timeZone : null);
  // An Everyone search-window hint is not independent evidence of the zone
  // used by saved availability facts. Keep those statuses unknown until reviewed.
  const checkingScope = availabilityZone ? scope : { ...scope, roster: scope.roster.map(p => p.evidence === 'planning-fact' ? { ...p, availability: 'missing' as const } : p) };
  const result = assessPlaces([{ id: `backup-${backup.id}`, name: d.activity, address: d.meetingPoint, category: 'any', lat: null, lon: null, source: 'organizer', sourceUrl: null, retrievedAt: new Date(now).toISOString(), price: { amount: d.cost.amount, currency: d.cost.currency, basis: d.cost.basis, coverage: d.cost.kind === 'total' ? 'total' : 'unknown' }, hours: unknownHours }], null, { area: 'Unresolved', radiusKm: 30, category: 'any', date: d.date, start: d.time, end: backup.endTime, timeZone: d.timeZone }, summary, spending, [], undefined, checkingScope, undefined, availabilityZone).ranked![0];
  const checks = [...result.checks];
  // The organizer's declared total may already prove a budget failure even
  // when an unverified address prevents discovery from certifying its price.
  const declaredPrice = { price: { amount: d.cost.amount, currency: d.cost.currency, basis: d.cost.basis, coverage: d.cost.kind === 'total' ? 'total' as const : 'unknown' as const } };
  for (const f of summary.facts.filter(current)) if (f.kind === 'budget' && settled(f) && f.strength === 'firm' && attributed(f, summary)) checks.push(budgetCheck(declaredPrice, f, 'budget', true));
  if (spending.length) {
    const statuses = spending.map(v => budgetCheck(declaredPrice, v.state === 'known' ? v : { amount: null, currency: null }, 'private-budget', true).status);
    checks.push({ kind: 'private-budget', status: statuses.includes('does-not-fit') ? 'does-not-fit' : statuses.includes('needs-checking') ? 'needs-checking' : 'fits', detail: 'Private spending check: only a general result is disclosed; individual limits stay private.' });
  }
  // A known out-of-bounds start is a conflict even while the end is unknown.
  for (const f of summary.facts.filter(current)) if (f.kind === 'schedule' && settled(f) && f.strength === 'firm' && attributed(f, summary)) {
    if (availabilityZone !== d.timeZone) checks.push({ kind: 'timing', status: 'needs-checking', detail: 'Planning availability has no reliable comparable local zone. Confirm it before treating timing as verified.' });
    else if (f.exactDate && (f.exactDate !== d.date || f.startTime && d.time! < f.startTime || f.endTime && d.time! >= f.endTime)) checks.push({ kind: 'timing', status: 'does-not-fit', detail: 'Backup starts outside confirmed firm availability in the reviewed local zone.' });
  }
  const window = { date: d.date, start: d.time, end: backup.endTime, timeZone: d.timeZone };
  // Route evidence is tied to an exact destination/window/scope, not a venue
  // name. Preserve demonstrated firm failures, without certifying fresh travel.
  const routes = summary.organizerDecisions?.flatMap(decision => decision.checks ?? []).flatMap(check => check.evidence.travel ? [check.evidence.travel] : []).filter(e => e.destination === d.meetingPoint && e.date === d.date && e.arrival === d.time && e.timeZone === d.timeZone) ?? [];
  for (const f of summary.facts.filter(current)) if (f.kind === 'travel' && settled(f) && f.strength === 'firm' && attributed(f, summary)) for (const e of routes.filter(e => travelMode(f.mode) === e.mode)) {
    const check = travelCheck(f, { travel: e }, window, d.meetingPoint, scope.roster.filter(p => p.selected).map(p => p.id));
    if (check.status === 'does-not-fit') checks.push(check);
  }
  for (const e of travel?.setup.estimates.filter(e => e.address === d.meetingPoint) ?? []) checks.push(...travelLimitChecks(travel, e.key, d.meetingPoint, window, summary));
  if (!backup.endTime) checks.push({ kind: 'timing', status: 'needs-checking', detail: 'Backup end time / duration is unknown; the whole outing cannot be checked against availability.' });
  else if (localInstant(d.date!, backup.endTime, d.timeZone!) === null) checks.push({ kind: 'timing', status: 'needs-checking', detail: 'The backup end clock is ambiguous or nonexistent in its local zone.' });
  if (backup.option.kind === 'event') checks.push({ kind: 'timing', status: 'needs-checking', detail: 'Recheck the specific event’s current schedule and status. Its saved display text is not fresh schedule evidence.' });
  const uniqueChecks = [...new Map(checks.map(c => [JSON.stringify(c), c])).values()];
  return backupAssessmentSchema.parse({ status: checks.some(c => c.blocking !== false && c.status === 'does-not-fit') ? 'does-not-fit' : checks.some(c => c.blocking !== false && c.status === 'needs-checking') ? 'needs-checking' : 'fits', checks: uniqueChecks, scope: checkingScope, checkedAt: new Date(now).toISOString() });
}
const publicChecks: Record<string, string> = { budget: 'Confirm total per-person cost, currency and any fees', 'private-budget': 'Confirm total per-person cost, currency and any fees', timing: 'Confirm full duration, everyone’s availability and date-specific hours or event schedule', travel: 'Travel times and travel requirements need checking for the intended attendees', constraint: 'Open planning questions or other group requirements remain unresolved', address: 'Confirm the backup meeting point / venue address', radius: 'Backup location and search boundary have not been verified', booking: 'Confirm ticket, booking and group availability; publication does not reserve anything' };
export function backupPublicDetails(backup: PlanBackup, assessment: BackupAssessment): PlanDetails {
  const d = backup.details;
  return planDetailsSchema.parse({ ...d, endTime: backup.endTime, attendanceScope: { mode: assessment.scope.mode, count: assessment.scope.attendeeCount }, unresolved: [...new Set([...backup.option.unresolved, ...d.unresolved, ...assessment.checks.filter(c => c.status !== 'fits').map(c => publicChecks[c.kind])])] });
}
