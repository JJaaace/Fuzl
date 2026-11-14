import { z } from 'zod';
import { guestTokenSchema } from './guests.js';
import { sourceLinkSchema } from './places.js';
import { placeEvidence } from './place-evidence.js';
import type { AssessedPlace } from './places.js';
import type { AssessedEvent } from './events.js';
export const ballotLinkSchema = z.strictObject({ kind: z.enum(['source', 'attribution']).optional(), label: z.string().trim().min(1).max(100), url: sourceLinkSchema.refine(v => { try { const u = new URL(v); return ![...u.searchParams.keys()].some(k => /key|token|secret|authorization|invite/i.test(k)) && !/token=|invite=|access_token/i.test(u.hash); } catch { return false; } }, 'Use a public source link without credentials.') });
export const ballotOptionSchema = z.strictObject({ id: z.string().uuid(), kind: z.enum(['place', 'event', 'idea']), name: z.string().trim().min(1).max(300), time: z.string().trim().max(300).nullable(), location: z.string().trim().max(800).nullable(), cost: z.strictObject({ amount: z.number().finite().min(0).max(1000000).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(), kind: z.enum(['starting', 'total', 'unknown']), basis: z.enum(['per-person', 'group', 'unknown']) }), links: z.array(ballotLinkSchema).max(4), unresolved: z.array(z.string().trim().min(1).max(300)).max(12), sample: z.boolean() });
export type BallotOption = z.infer<typeof ballotOptionSchema>;
export function ballotSourceUrl(option: BallotOption) { return option.links.find(l => l.kind !== 'attribution')?.url ?? null; }
export const shortlistContentSchema = z.strictObject({ title: z.string().trim().min(1).max(100), options: z.array(ballotOptionSchema).max(3) }).refine(v => new Set(v.options.map(o => o.id)).size === v.options.length, 'Option IDs must be distinct.');
export const shortlistSaveSchema = z.strictObject({ content: shortlistContentSchema, revision: z.number().int().min(0), sessionRevision: z.number().int().positive() });
export type ShortlistContent = z.infer<typeof shortlistContentSchema>;
export const shortlistSchema = z.strictObject({ content: shortlistContentSchema, revision: z.number().int().positive() });
export const ballotPublishSchema = z.strictObject({ publicationId: z.string().uuid(), inviteToken: guestTokenSchema, expectedBallotId: z.string().uuid().nullable(), shortlistRevision: z.number().int().positive(), sessionRevision: z.number().int().positive(), approved: z.literal(true), days: z.union([z.literal(1), z.literal(7), z.literal(14)]) });
export type BallotPublish = z.infer<typeof ballotPublishSchema>;
export const ballotViewSchema = z.strictObject({ id: z.string().uuid(), version: z.number().int().positive(), title: z.string().min(1).max(100), options: z.array(ballotOptionSchema).min(1).max(3), state: z.enum(['open', 'closed', 'superseded', 'expired', 'revoked']), expiresAt: z.string().datetime(), supersededByVersion: z.number().int().positive().nullable() });
export type BallotView = z.infer<typeof ballotViewSchema>;
export const ballotTallySchema = ballotViewSchema.extend({ totalResponses: z.number().int().min(0), counts: z.array(z.strictObject({ optionId: z.string().uuid(), votes: z.number().int().min(0) })).max(3), revision: z.number().int().positive() });
export type BallotTally = z.infer<typeof ballotTallySchema>;
export const ballotDashboardSchema = z.strictObject({ shortlist: shortlistSchema.nullable(), ballots: z.array(ballotTallySchema).max(30) });
export type BallotDashboard = z.infer<typeof ballotDashboardSchema>;
export const voteCreateSchema = z.strictObject({ submissionId: z.string().uuid(), editToken: guestTokenSchema, optionId: z.string().uuid() });
export const voteEditSchema = z.strictObject({ optionId: z.string().uuid(), revision: z.number().int().positive(), requestId: z.string().uuid() });
export const voteSchema = z.strictObject({ optionId: z.string().uuid(), revision: z.number().int().positive(), updatedAt: z.string().datetime() });
export type OwnVote = z.infer<typeof voteSchema>;
export function tallyLabel(tally: Pick<BallotTally, 'counts' | 'totalResponses'>) {
  if (!tally.totalResponses) return 'No votes yet';
  const highest = Math.max(...tally.counts.map(c => c.votes)), leaders = tally.counts.filter(c => c.votes === highest);
  return leaders.length > 1 ? `Tie between ${leaders.length} options at ${highest} vote${highest === 1 ? '' : 's'} each` : `Leading option has ${highest} vote${highest === 1 ? '' : 's'}`;
}
const costUnknowns = ['Confirm total cost and any fees', 'Ticket, booking and group availability unverified', 'Travel time unknown'];
export function shortlistPlace(place: AssessedPlace, id: string): BallotOption {
  const c = place.candidate, e = placeEvidence(c), v = e.effective, p = v.price;
  return ballotOptionSchema.parse({ id, kind: 'place', name: c.name, time: place.localWindow ? `Proposed window: ${place.localWindow}` : null, location: v.address, cost: { amount: p.amount, currency: p.currency, kind: p.coverage === 'total' ? 'total' : 'unknown', basis: p.basis }, links: [...(c.sourceUrl ? [{ label: c.source === 'geoapify' ? 'Provider map — address unverified' : 'Supplied source', url: c.sourceUrl }] : []), ...(c.savedIdea?.origin === 'geoapify' ? [{ kind: 'attribution', label: 'Powered by Geoapify', url: 'https://www.geoapify.com/' }, { kind: 'attribution', label: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' }] : []), ...(e.official ? [{ label: 'Official page — organizer matched', url: e.official.value }] : [])], unresolved: [...costUnknowns, ...(e.addressNeedsChecking ? ['Address needs checking; sources may disagree'] : []), ...(v.hours.kind !== 'date-specific' ? ['Date-specific hours unknown'] : []), ...(place.status === 'does-not-fit' ? ['This option was excluded by discovery checks. Voting cannot waive firm constraints.'] : []), 'Check age, accessibility, diet and other group requirements'], sample: c.source === 'demo' || c.savedIdea?.sample === true });
}
export function shortlistEvent(result: AssessedEvent, id: string): BallotOption {
  const e = result.event, s = e.schedule;
  return ballotOptionSchema.parse({ id, kind: 'event', name: e.title, time: `${s.date ?? 'Date unknown'} · ${s.time ?? 'Start time unknown'} · ${s.timeZone ?? 'Time zone unknown'}${s.dateUncertain || s.timeUncertain || s.zoneConflict ? ' · Schedule needs checking' : ''} · Provider status: ${e.providerStatus ?? 'unknown'}`, location: [e.venue.name, e.venue.address, e.venue.city, e.venue.state].filter(Boolean).join(', ') || null, cost: { amount: e.price.amount, currency: e.price.currency, kind: e.price.kind, basis: e.price.basis }, links: e.sourceUrl ? [{ label: e.source === 'demo' || e.savedIdea?.sample ? 'Example event source (sample)' : e.source === 'organizer' ? 'Organizer-supplied event reference' : 'Specific event / ticket listing', url: e.sourceUrl }] : [], unresolved: [...costUnknowns, ...(!s.endDate || !s.endTime ? ['Event end time / duration unknown'] : []), 'Provider address needs checking', ...(result.status === 'does-not-fit' ? ['This event was excluded by discovery checks. Voting cannot waive firm constraints.'] : []), 'Check current event status, age, accessibility and other requirements'], sample: e.source === 'demo' || e.savedIdea?.sample === true });
}
