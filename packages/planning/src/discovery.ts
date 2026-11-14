import { z } from 'zod';

export const discoveryPreferenceSchema = z.enum(['balanced', 'familiar', 'new']);
export type DiscoveryPreference = z.infer<typeof discoveryPreferenceSchema>;
// Server-only input, resolved from completed outings of the owned saved group.
export interface GroupVisitHistory { sourceUrls: string[]; uncertain: boolean }
export const discoveryEvidenceSchema = z.strictObject({
  visit: z.enum(['recorded', 'no-recorded-visit', 'unknown']),
  favorite: z.boolean(), reason: z.string().max(160),
}).refine(v => !v.favorite || v.visit === 'recorded');
export type DiscoveryEvidence = z.infer<typeof discoveryEvidenceSchema>;
export function discoveryEvidence(sourceUrl: string | null, memory: { boost: number; sentiment?: 'positive' | 'mixed' | 'negative' | 'unrated' } | undefined, history?: GroupVisitHistory, saved = false): DiscoveryEvidence {
  // An existing exact approved-memory match also originates in a completed,
  // explicitly matched outing, even when older than the bounded history read.
  const recorded = sourceUrl !== null && (history?.sourceUrls.includes(sourceUrl) === true || memory !== undefined);
  const visit = recorded ? 'recorded' : sourceUrl === null || !history || history.uncertain ? 'unknown' : 'no-recorded-visit';
  const favorite = recorded && memory?.boost === 2 && memory.sentiment === 'positive';
  let reason = visit === 'unknown' ? 'Visit match unknown' : 'No visit recorded';
  if (recorded) {
    reason = favorite ? 'Your group liked this last time'
      : memory?.sentiment === 'mixed' ? 'Previously visited · feedback was mixed'
        : memory?.sentiment === 'negative' ? 'Previously visited · feedback did not favor repeating'
          : 'Previously visited · no approved positive repeat feedback';
  }
  return { visit, favorite, reason: `${saved ? 'Saved for later · ' : ''}${reason}` };
}
interface Ranked { status: 'fits' | 'needs-checking' | 'does-not-fit'; discovery?: DiscoveryEvidence }
// A preference moves a candidate at most two places above its balanced position.
// Equal adjusted positions retain the original order. Categories never mix.
export function rankDiscovery<T extends Ranked>(baseline: readonly T[], preference: DiscoveryPreference) {
  let evidence = false;
  const ordered = (['fits', 'needs-checking', 'does-not-fit'] as const).flatMap(status => {
    const rows = baseline.filter(row => row.status === status);
    if (status === 'does-not-fit' || preference === 'balanced') return rows;
    const boosted = (row: T) => preference === 'familiar' ? row.discovery?.favorite === true : row.discovery?.visit === 'no-recorded-visit';
    const enough = preference === 'familiar' ? rows.some(boosted) && rows.some(row => !boosted(row)) : rows.some(row => row.discovery?.visit === 'recorded') && rows.some(boosted);
    if (!enough) return rows;
    evidence = true;
    return rows.map((row, index) => ({ row, index, score: index - (boosted(row) ? 2 : 0) })).sort((a, b) => a.score - b.score || a.index - b.index).map(v => v.row);
  });
  const changed = ordered.some((row, i) => row !== baseline[i]);
  const notice = preference === 'balanced' ? 'Balanced keeps the usual ranking. Firm constraints and selected shortlist options stay unchanged.'
    : !evidence ? 'Too little matched group history to distinguish these options within their fit categories. Keeping the usual order; no visit recorded does not mean never visited.'
      : changed ? 'Reordered within each fit category using a small group-history preference. No visit recorded does not mean never visited; firm checks and shortlist selections stay unchanged.'
        : 'The usual order already reflects this preference within the available fit categories. No visit recorded does not mean never visited.';
  return { ordered, notice, changed };
}
