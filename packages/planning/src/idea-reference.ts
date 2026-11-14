import { z } from 'zod';
export const ideaReferenceSchema = z.strictObject({ id: z.string().uuid(), revision: z.number().int().positive() });
export const ideaReferencesSchema = z.array(ideaReferenceSchema).max(3).refine(v => new Set(v.map(r => r.id)).size === v.length);
export type IdeaReference = z.infer<typeof ideaReferenceSchema>;
export const savedIdeaLabelSchema = z.strictObject({ ...ideaReferenceSchema.shape, origin: z.enum(['manual', 'geoapify', 'ticketmaster', 'demo']), lastCheckedOn: z.string().nullable(), sample: z.boolean() });
