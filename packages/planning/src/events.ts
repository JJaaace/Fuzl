import { z } from 'zod';
import { savedSummarySchema, summaryReferencesValid } from './saved.js';
import { areaSchema, clockSchema, localDateSchema, placeClarificationSchema, placeQuerySchema, sourceLinkSchema, zoneSchema } from './places.js';
export const eventQuerySchema = z.strictObject({
  area: placeQuerySchema.shape.area, resolutionId: placeQuerySchema.shape.resolutionId,
  radiusKm: placeQuerySchema.shape.radiusKm,
  from: localDateSchema, to: localDateSchema,
}).refine(q => q.to >= q.from && Date.parse(q.to) - Date.parse(q.from) <= 30 * 86400000, 'Choose an ordered date range of at most 31 days.');
export type EventQuery = z.infer<typeof eventQuerySchema>;
export const eventSearchSchema = z.strictObject({ mode: z.enum(['demo', 'live']), sessionRevision: z.number().int().positive(), summary: savedSummarySchema.refine(summaryReferencesValid), query: eventQuerySchema });
export type EventSearch = z.infer<typeof eventSearchSchema>;
export const scheduledEventSchema = z.strictObject({
  id: z.string().min(1).max(300), title: z.string().min(1).max(300),
  source: z.enum(['ticketmaster', 'demo']), sourceUrl: sourceLinkSchema, retrievedAt: z.string().datetime(),
  providerStatus: z.string().min(1).max(100).nullable(),
  venue: z.strictObject({ name: z.string().max(160).nullable(), address: z.string().max(300).nullable(), city: z.string().max(100).nullable(), state: z.string().max(100).nullable(), lat: z.number().min(-90).max(90).nullable(), lon: z.number().min(-180).max(180).nullable() }),
  schedule: z.strictObject({ date: localDateSchema.nullable(), time: clockSchema.nullable(), endDate: localDateSchema.nullable(), endTime: clockSchema.nullable(), timeZone: zoneSchema.nullable(), utcStart: z.string().datetime().nullable(), dateUncertain: z.boolean(), timeUncertain: z.boolean(), zoneConflict: z.boolean() }),
  price: z.strictObject({ amount: z.number().finite().min(0).max(1000000).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(), kind: z.enum(['starting', 'total', 'unknown']), basis: z.enum(['per-person', 'unknown']), fees: z.enum(['included', 'unknown']) }),
});
export type ScheduledEvent = z.infer<typeof scheduledEventSchema>;
// A source's onsale/offsale status never establishes remaining ticket inventory.
export const eventCheckSchema = z.strictObject({ kind: z.enum(['budget', 'private-budget', 'timing', 'travel', 'constraint', 'address', 'radius', 'booking', 'event-status']), status: z.enum(['fits', 'needs-checking', 'does-not-fit']), detail: z.string().max(700), blocking: z.boolean().optional() });
export type EventCheck = z.infer<typeof eventCheckSchema>;
export const assessedEventSchema = z.strictObject({ event: scheduledEventSchema, status: z.enum(['fits', 'needs-checking', 'does-not-fit']), checks: z.array(eventCheckSchema).max(200), distanceKm: z.number().nullable(), reason: z.string(), nextStep: z.string() });
export type AssessedEvent = z.infer<typeof assessedEventSchema>;
export const eventResultsSchema = z.strictObject({ mode: z.enum(['demo', 'live']), area: areaSchema, query: eventQuerySchema, retrievedAt: z.string().datetime(), verified: z.array(assessedEventSchema).max(3), promising: z.array(assessedEventSchema).max(3), excluded: z.array(assessedEventSchema).max(20), notices: z.array(z.string()).max(12) }).refine(r => r.verified.length + r.promising.length <= 3);
export type EventResults = z.infer<typeof eventResultsSchema>;
export const eventResponseSchema = z.union([eventResultsSchema, placeClarificationSchema]);
export type EventResponse = z.infer<typeof eventResponseSchema>;
