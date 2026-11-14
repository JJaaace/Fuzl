import type { z } from 'zod';
import type { cardIdeaSchema } from '@fuzl/planning';
export type { IdeaContent, SavedIdea, IdeaReference } from '@fuzl/planning';
export type CardIdeaInput = z.infer<typeof cardIdeaSchema>;
