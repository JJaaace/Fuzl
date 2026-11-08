import { z } from 'zod';
import { parseUsArea } from './place-location.js';
import { savedSummarySchema, summaryReferencesValid } from './saved.js';
export const placeCategories = ['any', 'park', 'museum', 'restaurant', 'cafe', 'bowling'] as const;
export const placeCategorySchema = z.enum(placeCategories);
export const sourceLinkSchema = z.string().url().max(1000).refine(value => { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; });
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const zoneSchema = z.string().min(1).max(80).refine(v => { try { new Intl.DateTimeFormat('en-US', { timeZone: v }); return true; } catch { return false; } });
export const placePriceSchema = z.strictObject({ amount: z.number().finite().min(0).max(1000000).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(), basis: z.enum(['per-person', 'group', 'unknown']), coverage: z.enum(['total', 'admission-only', 'unknown']) });
export const placeHoursSchema = z.strictObject({ kind: z.enum(['unknown', 'regular', 'date-specific']), text: z.string().max(300).nullable(), date: localDateSchema.nullable(), start: clockSchema.nullable(), end: clockSchema.nullable(), timeZone: zoneSchema.nullable(), closed: z.boolean() }).refine(v => v.kind !== 'date-specific' || (!!v.date && !!v.timeZone && (v.closed || (!!v.start && !!v.end && v.start < v.end))));
export const evidenceSourceSchema = z.strictObject({ kind: z.enum(['provider-listing', 'official-page', 'organizer']), url: sourceLinkSchema, checkedOn: localDateSchema, verifiedForVenue: z.boolean() });
const addressValueSchema = z.strictObject({ address: z.string().trim().min(1).max(300), city: z.string().max(100).nullable(), state: z.string().max(100).nullable(), lat: z.number().min(-90).max(90).nullable(), lon: z.number().min(-180).max(180).nullable(), timeZone: zoneSchema.nullable() }).refine(v => (v.lat === null) === (v.lon === null));
const claimBase = { id: z.string().min(1).max(80), source: evidenceSourceSchema };
export const placeClaimSchema = z.discriminatedUnion('field', [
  z.strictObject({ ...claimBase, field: z.literal('address'), value: addressValueSchema }),
  z.strictObject({ ...claimBase, field: z.literal('price'), value: placePriceSchema, addressId: z.string().max(80).optional() }),
  z.strictObject({ ...claimBase, field: z.literal('hours'), value: placeHoursSchema, addressId: z.string().min(1).max(80) }),
  z.strictObject({ ...claimBase, field: z.literal('official-link'), value: sourceLinkSchema, matchNote: z.string().trim().min(12).max(300) }),
]);
export type PlaceClaim = z.infer<typeof placeClaimSchema>;
export const selectionSchema = z.strictObject({ address: z.string().max(80).nullable(), price: z.string().max(80).nullable(), hours: z.string().max(80).nullable(), 'official-link': z.string().max(80).nullable() });
export const evidenceSchema = z.strictObject({ claims: z.array(placeClaimSchema).max(12), selected: selectionSchema, listingChanged: z.boolean(), confirmedOn: localDateSchema.nullable().optional() }).refine(e => new Set(e.claims.map(c => c.id)).size === e.claims.length && Object.entries(e.selected).every(([field, id]) => id === null || e.claims.some(c => c.id === id && c.field === field)));
export const correctionSchema = z.strictObject({ candidateId: z.string().min(1).max(300), candidateSource: z.enum(['geoapify', 'demo', 'organizer']), listingKey: z.string().max(5000), claims: z.array(placeClaimSchema).max(8).refine(claims => new Set(claims.map(c => c.id)).size === claims.length && claims.every(c => !c.id.startsWith('listing-') && c.source.kind !== 'provider-listing' && c.source.verifiedForVenue && (c.field !== 'official-link' || c.source.kind === 'official-page' && c.value === c.source.url && c.value.startsWith('https://')))), selected: selectionSchema, confirmedOn: localDateSchema.nullable().optional() }).refine(v => (!v.selected.address || !!v.confirmedOn) && (!v.confirmedOn || v.confirmedOn <= new Date().toISOString().slice(0, 10)) && v.claims.every(c => c.source.checkedOn <= new Date().toISOString().slice(0, 10)));
export type PlaceCorrection = z.infer<typeof correctionSchema>;
export const candidateSchema = z.strictObject({
  id: z.string().min(1).max(300), name: z.string().min(1).max(160), address: z.string().max(300).nullable(), category: placeCategorySchema,
  lat: z.number().min(-90).max(90).nullable(), lon: z.number().min(-180).max(180).nullable(),
  source: z.enum(['geoapify', 'demo', 'organizer']), sourceUrl: sourceLinkSchema, retrievedAt: z.string().datetime(),
  price: placePriceSchema, hours: placeHoursSchema, city: z.string().max(100).nullable().optional(), state: z.string().max(100).nullable().optional(), timeZone: zoneSchema.nullable().optional(), evidence: evidenceSchema.optional(),
});
export type PlaceCandidate = z.infer<typeof candidateSchema>;
export const manualCandidateSchema = candidateSchema.omit({ id: true, source: true, retrievedAt: true, evidence: true }).extend({ manualId: z.string().uuid().optional() });
export const placeQuerySchema = z.strictObject({
  area: z.string().trim().min(2).max(100).refine(v => parseUsArea(v) !== null, 'Use a five-digit US ZIP or city, optionally with a valid state.'),
  resolutionId: z.string().min(1).max(300).optional(),
  radiusKm: z.number().min(1).max(30), category: placeCategorySchema,
  date: localDateSchema.nullable(), start: clockSchema.nullable(), end: clockSchema.nullable(), timeZone: zoneSchema.nullable(),
}).refine(v => !v.start || !v.end || v.end > v.start);
export type PlaceQuery = z.infer<typeof placeQuerySchema>;
export const placeSearchSchema = z.strictObject({
  mode: z.enum(['demo', 'live']), sessionRevision: z.number().int().positive(),
  summary: savedSummarySchema.refine(summaryReferencesValid), query: placeQuerySchema,
  manual: z.array(manualCandidateSchema).max(3), corrections: z.array(correctionSchema).max(23).optional(),
});
export type PlaceSearch = z.infer<typeof placeSearchSchema>;
export interface PlaceArea { label: string; lat: number; lon: number; timeZone: string | null; city?: string | null; state?: string | null; postcode?: string | null }
export const areaSchema = z.strictObject({ label: z.string().max(300), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), timeZone: zoneSchema.nullable(), city: z.string().max(100).nullable().optional(), state: z.string().max(100).nullable().optional(), postcode: z.string().max(20).nullable().optional() });
export const areaChoiceSchema = areaSchema.extend({ id: z.string().min(1).max(300) });
export type AreaChoice = z.infer<typeof areaChoiceSchema>;
export type PlaceDiscovery = { area: PlaceArea; candidates: PlaceCandidate[] } | { choices: AreaChoice[] };
export const fitStates = ['fits', 'needs-checking', 'does-not-fit'] as const;
export const fitCheckSchema = z.strictObject({ kind: z.enum(['budget', 'private-budget', 'timing', 'travel', 'constraint', 'address', 'radius', 'booking']), status: z.enum(fitStates), detail: z.string().max(350), blocking: z.boolean().optional() });
export type FitCheck = z.infer<typeof fitCheckSchema>;
export const assessedPlaceSchema = z.strictObject({ candidate: candidateSchema, status: z.enum(fitStates), checks: z.array(fitCheckSchema).max(70), reason: z.string().max(350), nextStep: z.string().max(150), distanceKm: z.number().nonnegative().nullable(), ranking: z.array(z.string().max(150)).max(4), effectiveAddress: z.string().nullable().optional(), localWindow: z.string().max(200).nullable().optional() });
export type AssessedPlace = z.infer<typeof assessedPlaceSchema>;
export const placeResultsSchema = z.strictObject({ mode: z.enum(['demo', 'live']), searchId: z.string().uuid().nullable().optional(), coverage: z.enum(['empty', 'sparse', 'available']).optional(), area: areaSchema, retrievedAt: z.string().datetime(), verified: z.array(assessedPlaceSchema).max(3), promising: z.array(assessedPlaceSchema).max(3), excluded: z.array(assessedPlaceSchema).max(23), notices: z.array(z.string().max(350)).max(10) }).refine(v => v.verified.length + v.promising.length <= 3);
export type PlaceResults = z.infer<typeof placeResultsSchema>;
export const unknownPrice: PlaceCandidate['price'] = { amount: null, currency: null, basis: 'unknown', coverage: 'unknown' };
export const unknownHours: PlaceCandidate['hours'] = { kind: 'unknown', text: null, date: null, start: null, end: null, timeZone: null, closed: false };

export const placeClarificationSchema = z.strictObject({ kind: z.literal('clarification'), mode: z.enum(['demo', 'live']), choices: z.array(areaChoiceSchema).min(1).max(5), message: z.string().max(350) });
export const placeResponseSchema = z.union([placeClarificationSchema, placeResultsSchema]);
export type PlaceResponse = z.infer<typeof placeResponseSchema>;
export const placeRecheckSchema = placeSearchSchema.extend({ searchId: z.string().uuid() });
