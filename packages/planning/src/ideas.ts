import { z } from 'zod';
import { clockSchema, localDateSchema, zoneSchema, placeCategorySchema, unknownPrice, unknownHours } from './places.js';
import type { PlaceCandidate } from './places.js';
import type { ScheduledEvent } from './events.js';
import { savedIdeaLabelSchema } from './idea-reference.js';
export const ideaLinkSchema = z.string().trim().url().max(1000).refine(v => { try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && ![...u.searchParams.keys()].some(k => /key|token|secret|authorization|invite/i.test(k)) && !/token=|invite=/i.test(u.hash); } catch { return false; } });
export const ideaContentSchema = z.strictObject({ name: z.string().trim().min(1).max(160), link: ideaLinkSchema.nullable(), note: z.string().trim().max(500), kind: z.enum(['venue', 'event', 'idea']), eventDate: localDateSchema.nullable(), start: clockSchema.nullable(), end: clockSchema.nullable(), timeZone: zoneSchema.nullable(), address: z.string().trim().max(300).nullable(), category: placeCategorySchema, lat: z.number().min(-90).max(90).nullable(), lon: z.number().min(-180).max(180).nullable(), lastCheckedOn: localDateSchema.refine(v => v <= new Date().toISOString().slice(0, 10)).nullable() }).refine(v => (v.lat === null) === (v.lon === null) && (!v.start || !v.end || v.end > v.start) && (v.kind === 'event' || !v.eventDate && !v.start && !v.end));
export type IdeaContent = z.infer<typeof ideaContentSchema>;
export const ideaOriginSchema = z.strictObject({ provider: z.enum(['manual', 'geoapify', 'ticketmaster', 'demo']), itemId: z.string().max(300).nullable(), referenceUrl: ideaLinkSchema.nullable() });
export const ideaSchema = z.strictObject({ id: z.string().uuid(), groupId: z.string().uuid(), revision: z.number().int().positive(), content: ideaContentSchema, origin: ideaOriginSchema, archived: z.boolean(), edited: z.boolean(), dateState: z.enum(['ongoing', 'upcoming', 'past', 'date-needs-checking']), createdAt: z.string().datetime(), updatedAt: z.string().datetime() });
export type SavedIdea = z.infer<typeof ideaSchema>;
export const ideaListSchema = z.array(ideaSchema).max(100);
export const ideaChoiceSchema = z.strictObject({ id: z.string().uuid(), revision: z.number().int().positive(), name: z.string(), kind: z.enum(['venue', 'event', 'idea']), link: ideaLinkSchema.nullable(), lastCheckedOn: localDateSchema.nullable(), origin: z.enum(['manual', 'geoapify', 'ticketmaster', 'demo']) });
export const ideaChoicesSchema = z.array(ideaChoiceSchema).max(100);
export type IdeaChoice = z.infer<typeof ideaChoiceSchema>;
export const createIdeaSchema = z.strictObject({ requestId: z.string().uuid(), content: ideaContentSchema, allowDuplicate: z.boolean() });
export const updateIdeaSchema = z.strictObject({ requestId: z.string().uuid(), revision: z.number().int().positive(), content: ideaContentSchema, allowDuplicate: z.boolean() });
export const controlIdeaSchema = z.strictObject({ requestId: z.string().uuid(), revision: z.number().int().positive(), archived: z.boolean() });
export const deleteIdeaSchema = z.strictObject({ revision: z.number().int().positive() });
export const cardIdeaSchema = createIdeaSchema.extend({ snapshotId: z.string().uuid(), candidateKey: z.string().max(400), sessionRevision: z.number().int().positive() });
export function emptyIdea(): IdeaContent { return { name: '', link: null, note: '', kind: 'venue', eventDate: null, start: null, end: null, timeZone: null, address: null, category: 'any', lat: null, lon: null, lastCheckedOn: null }; }
export function ideaDateState(c: Pick<IdeaContent, 'kind' | 'eventDate' | 'timeZone'>, now = Date.now()): SavedIdea['dateState'] {
  if (c.kind !== 'event') return 'ongoing'; if (!c.eventDate) return 'date-needs-checking';
  const utc = new Date(now).toISOString().slice(0, 10);
  if (!c.timeZone) { const yesterday = new Date(now - 86400000).toISOString().slice(0, 10); return c.eventDate < yesterday ? 'past' : c.eventDate <= utc ? 'date-needs-checking' : 'upcoming'; }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: c.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return c.eventDate < `${get('year')}-${get('month')}-${get('day')}` ? 'past' : 'upcoming';
}
export function normalizedIdeaLink(link: string | null) { if (!link) return null; const u = new URL(link); u.hash = ''; for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k); u.searchParams.sort(); return u.toString().replace(/\/$/, ''); }
export function duplicateIdea(a: Pick<SavedIdea, 'content' | 'origin'>, b: Pick<SavedIdea, 'content' | 'origin'>) { const link = normalizedIdeaLink(a.content.link), other = normalizedIdeaLink(b.content.link); return !!link && link === other || a.origin.provider !== 'manual' && a.origin.provider === b.origin.provider && !!a.origin.itemId && a.origin.itemId === b.origin.itemId; }
function label(i: SavedIdea) { return savedIdeaLabelSchema.parse({ id: i.id, revision: i.revision, origin: i.origin.provider, lastCheckedOn: i.content.lastCheckedOn, sample: i.origin.provider === 'demo' }); }
export function ideaPlace(i: SavedIdea): PlaceCandidate {
  const c = i.content;
  return { id: `saved-${i.id}-${i.revision}`, source: 'organizer', sourceUrl: c.link, name: c.name, category: c.category, address: c.address, lat: c.lat, lon: c.lon, timeZone: c.timeZone, retrievedAt: i.updatedAt, price: { ...unknownPrice }, hours: { ...unknownHours }, savedIdea: label(i) };
}
export function ideaEvent(i: SavedIdea): ScheduledEvent {
  const c = i.content;
  return { id: `saved-${i.id}-${i.revision}`, source: 'organizer', sourceUrl: c.link, title: c.name, retrievedAt: i.updatedAt, providerStatus: null, venue: { name: null, address: c.address, city: null, state: null, lat: c.lat, lon: c.lon }, schedule: { date: c.eventDate, time: c.start, endDate: c.end ? c.eventDate : null, endTime: c.end, timeZone: c.timeZone, utcStart: null, dateUncertain: !c.eventDate, timeUncertain: !c.start, zoneConflict: false }, price: { amount: null, currency: null, basis: 'unknown', kind: 'unknown', fees: 'unknown' }, savedIdea: label(i) };
}
