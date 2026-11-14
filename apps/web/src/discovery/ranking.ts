import { rankDiscovery } from '@fuzl/planning';
import type { DiscoveryPreference, PlaceResults, EventResults } from '@fuzl/planning';
// Reorder already checked, owner-visible candidates only. Never change checks,
// summary, selected shortlist snapshots, cache generations or provider inputs.
export function preferredPlaces(result: PlaceResults, preference: DiscoveryPreference) {
  const ranked = rankDiscovery(result.ranked ?? [...result.verified, ...result.promising, ...result.excluded], preference);
  const useful = ranked.ordered.filter(r => r.status !== 'does-not-fit').slice(0, 3);
  return { result: { ...result, verified: useful.filter(r => r.status === 'fits'), promising: useful.filter(r => r.status === 'needs-checking'), excluded: ranked.ordered.filter(r => r.status === 'does-not-fit') }, notice: ranked.notice };
}
export function preferredEvents(result: EventResults, preference: DiscoveryPreference) {
  const ranked = rankDiscovery(result.ranked ?? [...result.verified, ...result.promising, ...result.excluded], preference);
  const useful = ranked.ordered.filter(r => r.status !== 'does-not-fit').slice(0, 3);
  return { result: { ...result, verified: useful.filter(r => r.status === 'fits'), promising: useful.filter(r => r.status === 'needs-checking'), excluded: ranked.ordered.filter(r => r.status === 'does-not-fit') }, notice: ranked.notice };
}
