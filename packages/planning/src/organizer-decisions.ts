import { z } from 'zod';
import { visitEvidenceSchema } from './visit-evidence.js';
export const organizerDecisionSchema = z.strictObject({ id: z.string().uuid(), kind: z.enum(['start-time', 'travel-limit']), factId: z.string().min(1).max(80), before: z.string().max(300), after: z.string().max(300), reason: z.string().max(350), sourceIds: z.array(z.string().max(80)).max(20), recordedAt: z.string().datetime(), checks: z.array(z.strictObject({ key: z.string().max(400), evidence: visitEvidenceSchema })).max(3).optional() });
export type OrganizerDecision = z.infer<typeof organizerDecisionSchema>;
