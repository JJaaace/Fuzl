import { z } from 'zod';
import { scopeResultSchema, scopeWindowSchema } from './participation-contract.js';
import type { ParticipationScope } from './participation-contract.js';
import type { PlanningSummary } from './model.js';
import { travelMode } from './visit-evidence.js';
import { localInstant } from './place-location.js';
export const travelModeSchema = z.enum(['driving', 'walking', 'cycling', 'transit']);
const minutes = z.number().int().min(0).max(360).nullable();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const unique = <T>(rows: T[], key: (v: T) => string) => new Set(rows.map(key)).size === rows.length;
export const travelHistorySchema = z.strictObject({ mode: travelModeSchema, basis: z.literal('one-way'), attendees: z.array(z.strictObject({ aliasId: z.string().uuid(), attended: z.literal(true), minutes })).max(20).refine(v => unique(v, r => r.aliasId)), reviewed: z.literal(true) });
export type TravelHistory = z.infer<typeof travelHistorySchema>;
export const travelSetupSchema = z.strictObject({ mode: travelModeSchema, basis: z.literal('one-way'), mappings: z.array(z.strictObject({ participantId: z.string().min(1).max(80), aliasId: z.string().uuid() })).max(20).refine(v => unique(v, r => r.participantId) && unique(v, r => r.aliasId)), estimates: z.array(z.strictObject({ key: z.string().min(1).max(300), address: z.string().min(1).max(800), window: scopeWindowSchema, checkedOn: day, sourceUrl: z.url().max(2000).refine(v => ['https:', 'http:'].includes(new URL(v).protocol) && !new URL(v).username && !new URL(v).password && ![...new URL(v).searchParams.keys()].some(k => /key|token|secret|authorization|invite/i.test(k)) && !/token=|invite=/i.test(new URL(v).hash)), minutes: z.array(z.strictObject({ participantId: z.string().min(1).max(80), minutes })).max(20).refine(v => unique(v, r => r.participantId)) })).max(23).refine(v => unique(v, r => r.key)), reviewed: z.literal(true) });
export type TravelSetup = z.infer<typeof travelSetupSchema>;
export const travelSetupEditSchema = z.strictObject({ revision: z.number().int().min(0), sessionRevision: z.number().int().positive(), scopeKey: z.string().regex(/^[a-f0-9]{64}$/), requestId: z.string().uuid(), setup: travelSetupSchema });
export const travelHistoryEditSchema = z.strictObject({ revision: z.number().int().positive(), requestId: z.string().uuid(), history: travelHistorySchema.nullable() });
export const travelDashboardSchema = z.strictObject({ revision: z.number().int().min(0), scope: scopeResultSchema, setup: travelSetupSchema.nullable(), current: z.boolean(), aliases: z.array(z.strictObject({ id: z.string().uuid(), name: z.string() })).max(200), outings: z.array(z.strictObject({ id: z.string().uuid(), sessionId: z.string().uuid(), revision: z.number().int().positive(), date: day, activity: z.string(), history: travelHistorySchema.nullable() })).max(100) });
export type TravelDashboard = z.infer<typeof travelDashboardSchema>;
// Server-only. Never serialize this context, individual minutes, aliases or origins.
export interface TravelContext { setup: TravelSetup; scope: ParticipationScope; outings: { date: string; history: TravelHistory }[]; now: number }
export interface BalanceRow { status: 'fits' | 'needs-checking' | 'does-not-fit'; checks: { kind: string; status: string; blocking?: boolean; detail?: string }[]; travelBalance?: string[] }
const selected = (s: ParticipationScope) => s.roster.filter(p => p.selected).map(p => p.id);
function currentEstimate(context: TravelContext, key: string, address: string | null, window: { date: string | null; start: string | null; end: string | null; timeZone: string | null }) {
  const { setup, scope, now } = context, e = setup.estimates.find(e => e.key === key && e.address === address && ['date', 'start', 'end', 'timeZone'].every(k => e.window[k as keyof typeof window] === window[k as keyof typeof window]));
  if (!scope.reviewed || !e || !window.date || !window.start || !window.timeZone) return null;
  const arrival = localInstant(window.date, window.start, window.timeZone), checked = Date.parse(e.checkedOn + 'T00:00:00Z');
  return arrival === null || checked > now || now - checked > 7 * 86400000 ? null : e;
}
export function travelVector(context: TravelContext, key: string, address: string | null, window: Parameters<typeof currentEstimate>[3]) {
  const ids = selected(context.scope), e = currentEstimate(context,key,address,window); if (!ids.length || !e) return null;
  const vector = ids.map(id => e.minutes.find(m => m.participantId === id)?.minutes ?? null);
  return vector.every((n): n is number => n !== null) ? vector : null;
}
// Reviewed current evidence adds checks and never clears existing uncertainty.
export function travelLimitChecks(context: TravelContext | undefined, key: string, address: string | null, window: Parameters<typeof travelVector>[3], summary: PlanningSummary) {
  if (!context) return [];
  const e = currentEstimate(context,key,address,window), ids = selected(context.scope);
  const vector = ids.map(id => e?.minutes.find(m => m.participantId === id)?.minutes ?? null);
  const failed = summary.facts.some(f => {
    if (f.kind !== 'travel' || f.status !== 'confirmed' || f.strength !== 'firm' || f.extraction && (!f.extraction.reviewed || f.extraction.scope === 'historical') || travelMode(f.mode) !== context.setup.mode || f.maxMinutes === null || f.comparison === 'unknown') return false;
    const subject = f.subject;
    const subjectId = subject.kind === 'participant' ? subject.participantId : subject.kind === 'speaker' ? summary.speakers.find(s => s.id === subject.speakerId)?.participantId : null;
    return vector.some((n,i) => n !== null && (f.subject.kind === 'group' || subjectId === ids[i]) && (f.comparison === 'under' ? n >= f.maxMinutes! : n > f.maxMinutes!));
  });
  return failed ? [{ kind: 'travel' as const, status: 'does-not-fit' as const, detail: 'A reviewed current travel estimate exceeds an intended attendee’s firm travel limit.' }]
    : vector.some(n => n === null) ? [{ kind: 'travel' as const, status: 'needs-checking' as const, detail: 'Reviewed individual travel estimates are incomplete, stale or do not match this option, address, time window and roster. Missing minutes stay unknown.' }] : [];
}
export function balanceTravel<T extends BalanceRow>(rows: readonly T[], context: TravelContext | undefined, identity: (r: T) => { key: string; address: string | null; window: Parameters<typeof travelVector>[3] }): T[] {
  if (!context || !context.scope.reviewed) return [...rows];
  const ids = selected(context.scope), aliases = ids.map(id => context.setup.mappings.find(m => m.participantId === id)?.aliasId);
  if (ids.length < 2 || aliases.some(v => !v)) return [...rows];
  // Only common, explicitly attended outings: latest five in the last 90 days,
  // at least two with every selected attendee recorded in the same mode/basis.
  const history = context.outings.filter(o => o.history.mode === context.setup.mode && Date.parse(o.date + 'T23:59:59Z') >= context.now - 90 * 86400000 && Date.parse(o.date + 'T00:00:00Z') <= context.now && aliases.every(id => o.history.attendees.some(a => a.aliasId === id && a.attended && a.minutes !== null))).sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  if (history.length < 2) return [...rows];
  const totals = aliases.map(id => history.reduce((sum,o) => sum + o.history.attendees.find(a => a.aliasId === id)!.minutes!,0));
  if (Math.max(...totals) - Math.min(...totals) < 10) return [...rows];
  const scores = rows.map((row,index) => { const { key,address,window } = identity(row), v = row.status === 'fits' ? travelVector(context,key,address,window) : null; if (!v) return { index, score: null, vector: null }; const next = totals.map((n,i) => n + v[i]); return { index, score: Math.max(...next) - Math.min(...next), vector: v }; });
  // Return safe ordinal hints only; no durations, owners or burden scores.
  return rows.map((row,index) => scores[index].score === null ? row : { ...row, travelBalance: scores.filter(s => s.score !== null && scores[index].score! + 5 <= s.score! && totals.every((n,i) => n !== Math.max(...totals) || scores[index].vector![i] + 5 <= s.vector![i]) && scores[index].vector!.reduce((a,b) => a+b,0) <= s.vector!.reduce((a,b) => a+b,0) + 10).map(s => identity(rows[s.index]).key) });
}
