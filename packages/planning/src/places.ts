import { z } from 'zod';
import { savedSummarySchema, summaryReferencesValid } from './saved.js';
export const placeCategories = ['any', 'park', 'museum', 'restaurant', 'cafe', 'bowling'] as const;
export const placeCategorySchema = z.enum(placeCategories);
export const sourceLinkSchema = z.string().url().max(1000).refine(value => { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; });
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const zoneSchema = z.string().min(1).max(80).refine(v => { try { new Intl.DateTimeFormat('en-US', { timeZone: v }); return true; } catch { return false; } });
export const placePriceSchema = z.strictObject({ amount: z.number().finite().min(0).max(1000000).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(), basis: z.enum(['per-person', 'group', 'unknown']), coverage: z.enum(['total', 'admission-only', 'unknown']) });
export const placeHoursSchema = z.strictObject({ kind: z.enum(['unknown', 'regular', 'date-specific']), text: z.string().max(300).nullable(), date: localDateSchema.nullable(), start: clockSchema.nullable(), end: clockSchema.nullable(), timeZone: zoneSchema.nullable(), closed: z.boolean() }).refine(v => v.kind !== 'date-specific' || (!!v.date && !!v.timeZone && (v.closed || (!!v.start && !!v.end && v.start < v.end))));
export const candidateSchema = z.strictObject({
  id: z.string().min(1).max(300), name: z.string().min(1).max(160), address: z.string().max(300).nullable(), category: placeCategorySchema,
  lat: z.number().min(-90).max(90).nullable(), lon: z.number().min(-180).max(180).nullable(),
  source: z.enum(['geoapify', 'demo', 'organizer']), sourceUrl: sourceLinkSchema, retrievedAt: z.string().datetime(),
  price: placePriceSchema, hours: placeHoursSchema,
});
export type PlaceCandidate = z.infer<typeof candidateSchema>;
export const manualCandidateSchema = candidateSchema.omit({ id: true, source: true, retrievedAt: true });
export const placeQuerySchema = z.strictObject({
  area: z.string().trim().min(2).max(100).refine(v => /^\d{5}$/.test(v) || /^[\p{L} .'-]+,\s*[\p{L} .]+$/u.test(v), 'Use a five-digit US ZIP or City, State.'),
  radiusKm: z.number().min(1).max(30), category: placeCategorySchema,
  date: localDateSchema.nullable(), start: clockSchema.nullable(), end: clockSchema.nullable(), timeZone: zoneSchema.nullable(),
}).refine(v => !v.start || !v.end || v.end > v.start);
export type PlaceQuery = z.infer<typeof placeQuerySchema>;
export const placeSearchSchema = z.strictObject({
  mode: z.enum(['demo', 'live']), sessionRevision: z.number().int().positive(),
  summary: savedSummarySchema.refine(summaryReferencesValid), query: placeQuerySchema,
  manual: z.array(manualCandidateSchema).max(3),
});
export type PlaceSearch = z.infer<typeof placeSearchSchema>;
export interface PlaceArea { label: string; lat: number; lon: number; timeZone: string | null }
const areaSchema = z.strictObject({ label: z.string().max(300), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), timeZone: zoneSchema.nullable() });
export const fitStates = ['fits', 'needs-checking', 'does-not-fit'] as const;
export const fitCheckSchema = z.strictObject({ kind: z.enum(['budget', 'private-budget', 'timing', 'travel', 'constraint']), status: z.enum(fitStates), detail: z.string().max(350) });
export type FitCheck = z.infer<typeof fitCheckSchema>;
export const assessedPlaceSchema = z.strictObject({ candidate: candidateSchema, status: z.enum(fitStates), checks: z.array(fitCheckSchema).max(70), reason: z.string().max(350), nextStep: z.string().max(150), distanceKm: z.number().nonnegative().nullable(), ranking: z.array(z.string().max(150)).max(4) });
export type AssessedPlace = z.infer<typeof assessedPlaceSchema>;
export const placeResultsSchema = z.strictObject({ mode: z.enum(['demo', 'live']), area: areaSchema, retrievedAt: z.string().datetime(), verified: z.array(assessedPlaceSchema).max(3), promising: z.array(assessedPlaceSchema).max(3), excluded: z.array(assessedPlaceSchema).max(23), notices: z.array(z.string().max(350)).max(10) }).refine(v => v.verified.length + v.promising.length <= 3);
export type PlaceResults = z.infer<typeof placeResultsSchema>;
export const unknownPrice: PlaceCandidate['price'] = { amount: null, currency: null, basis: 'unknown', coverage: 'unknown' };
export const unknownHours: PlaceCandidate['hours'] = { kind: 'unknown', text: null, date: null, start: null, end: null, timeZone: null, closed: false };
