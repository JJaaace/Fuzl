import { z } from 'zod';
export interface GroupMemory { sourceUrl: string | null; takeaway: string; sentiment: 'positive' | 'mixed' | 'negative' | 'unrated'; date: string; }
export const memoryInfluenceSchema = z.strictObject({ sentiment: z.enum(['positive', 'mixed', 'negative', 'unrated']).optional(), reason: z.string().max(600), boost: z.number().min(0).max(2) });
export type MemoryInfluence = z.infer<typeof memoryInfluenceSchema>;
// Exact public listing match only. No name/alias inference or person-level profile.
// The most recent approved observation wins; evidence is never accumulated into
// an ever-growing score or treated as a permanent preference.
export function memoryInfluence(url: string | null, memories: GroupMemory[] = []): MemoryInfluence | undefined {
  if (url === null) return undefined;
  const m = memories.filter(m => m.sourceUrl === url).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!m) return undefined;
  const label = m.sentiment === 'positive' ? 'Positive permitted feedback from self-reported attendees' : m.sentiment === 'mixed' ? 'permitted feedback was mixed' : m.sentiment === 'negative' ? 'permitted feedback did not favor repeating' : 'no repeat rating approved';
  return { sentiment: m.sentiment, reason: `Previously visited · ${label}. Approved group takeaway (${m.date}): ${m.takeaway}`, boost: m.sentiment === 'positive' ? 2 : 0 };
}
export function feedbackSentiment(rows: { attended: boolean; allowMemory: boolean; again: 'yes' | 'no' | 'unsure' | null }[]): GroupMemory['sentiment'] {
  const values = rows.filter(r => r.attended && r.allowMemory && r.again !== null).map(r => r.again);
  return !values.length ? 'unrated' : values.every(v => v === 'yes') ? 'positive' : values.every(v => v === 'no') ? 'negative' : 'mixed';
}
