import { z } from 'zod';
import { ballotOptionSchema, ballotLinkSchema } from './ballots.js';
import type { BallotOption } from './ballots.js';
import { guestTokenSchema } from './guests.js';
import { localDateSchema, clockSchema, zoneSchema } from './places.js';
import { localInstant } from './place-location.js';
export const planStatuses = ['proposed', 'confirmed', 'completed', 'cancelled'] as const;
export const rsvpChoices = ['going', 'maybe', 'cant'] as const;
export const planDetailsSchema = z.strictObject({ activity: z.string().trim().min(1).max(300), date: localDateSchema.nullable(), time: clockSchema.nullable(), timeZone: zoneSchema.nullable(), meetingPoint: z.string().trim().min(1).max(800).nullable(), cost: ballotOptionSchema.shape.cost, links: z.array(ballotLinkSchema).max(4), instructions: z.string().trim().max(1500), unresolved: z.array(z.string().trim().min(1).max(300)).max(16), booking: z.enum(['unknown', 'needs-booking', 'organizer-reported-booked']) });
export type PlanDetails = z.infer<typeof planDetailsSchema>;
export function publishablePlan(d: PlanDetails) { return !!d.date && !!d.time && !!d.timeZone && !!d.meetingPoint?.trim() && localInstant(d.date, d.time, d.timeZone) !== null; }
export const publishedDetailsSchema = planDetailsSchema.refine(publishablePlan, 'Choose a clear date, local time, time zone and meeting point; ambiguous/nonexistent daylight-saving clocks need correction.');
export const planDraftSchema = z.strictObject({ ballotId: z.string().uuid(), option: ballotOptionSchema, details: planDetailsSchema });
export type PlanDraft = z.infer<typeof planDraftSchema>;
export const planMutationBase = { requestId: z.string().uuid(), revision: z.number().int().min(0) };
export const selectPlanSchema = z.strictObject({ ...planMutationBase, sessionRevision: z.number().int().positive(), ballotId: z.string().uuid(), optionId: z.string().uuid() });
export const savePlanSchema = z.strictObject({ ...planMutationBase, details: planDetailsSchema });
export const publishPlanSchema = z.strictObject({ ...planMutationBase, approved: z.literal(true), previewKey: z.string().regex(/^[a-f0-9]{64}$/), notice: z.string().trim().min(8).max(350) });
export const controlPlanSchema = z.strictObject({ ...planMutationBase, action: z.enum(['completed', 'cancelled', 'close-rsvps']), notice: z.string().trim().min(8).max(350) });
export const planLinkInputSchema = z.strictObject({ ...planMutationBase, token: guestTokenSchema, days: z.union([z.literal(1), z.literal(7), z.literal(14)]), replace: z.boolean() });
export const publicPlanSchema = z.strictObject({ id: z.string().uuid(), version: z.number().int().positive(), materialVersion: z.number().int().positive(), status: z.enum(['confirmed', 'completed', 'cancelled']), details: publishedDetailsSchema, sample: z.boolean(), changeNotice: z.string().max(500), publishedAt: z.string().datetime(), rsvpOpen: z.boolean(), expiresAt: z.string().datetime() });
export type PublicPlan = z.infer<typeof publicPlanSchema>;
export const ownRsvpSchema = z.strictObject({ alias: z.string().min(1).max(80), choice: z.enum(rsvpChoices), revision: z.number().int().positive(), answeredMaterialVersion: z.number().int().positive(), needsReconfirmation: z.boolean(), updatedAt: z.string().datetime() });
export type OwnRsvp = z.infer<typeof ownRsvpSchema>;
export const rsvpPayloadSchema = z.strictObject({ alias: z.string().trim().min(1).max(80), choice: z.enum(rsvpChoices), planVersion: z.number().int().positive(), approved: z.literal(true) });
export const rsvpCreateSchema = z.strictObject({ submissionId: z.string().uuid(), editToken: guestTokenSchema, payload: rsvpPayloadSchema });
export const rsvpEditSchema = z.strictObject({ requestId: z.string().uuid(), revision: z.number().int().positive(), payload: rsvpPayloadSchema });
export const planOwnerSchema = z.strictObject({ id: z.string().uuid(), revision: z.number().int().positive(), status: z.enum(planStatuses), draftKey: z.string().regex(/^[a-f0-9]{64}$/), draft: planDraftSchema, published: publicPlanSchema.omit({ expiresAt: true }).nullable(), history: z.array(z.strictObject({ version: z.number().int().positive(), status: z.enum(planStatuses), changeNotice: z.string(), materialVersion: z.number().int().positive(), publishedAt: z.string().datetime() })).max(100), link: z.strictObject({ expiresAt: z.string().datetime(), revoked: z.boolean() }).nullable(), attendance: z.array(ownRsvpSchema.extend({ id: z.string().uuid() })).max(200), counts: z.strictObject({ going: z.number().int().min(0), maybe: z.number().int().min(0), cant: z.number().int().min(0), needsReconfirmation: z.number().int().min(0), totalResponses: z.number().int().min(0) }) });
export type OwnerPlan = z.infer<typeof planOwnerSchema>;
export function detailsFromOption(o: BallotOption): PlanDetails { return { activity: o.name, date: null, time: null, timeZone: null, meetingPoint: o.location, cost: { ...o.cost }, links: o.links.map(l => ({ ...l })), instructions: '', unresolved: [...o.unresolved, 'Confirm venue hours or the source event schedule for the exact chosen plan date and time'], booking: 'needs-booking' }; }
export function materialPlanKey(draft: PlanDraft) { const d = draft.details; return JSON.stringify([draft.option.id, d.activity, d.date, d.time, d.timeZone, d.meetingPoint, d.cost]); }
export function canPlanTransition(from: typeof planStatuses[number], to: typeof planStatuses[number]) { return from === 'proposed' && ['confirmed', 'cancelled'].includes(to) || from === 'confirmed' && ['confirmed', 'completed', 'cancelled'].includes(to); }
