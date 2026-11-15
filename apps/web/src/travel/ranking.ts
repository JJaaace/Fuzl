import { workKey } from '@fuzl/planning';
import type { AssessedPlace, AssessedEvent, DiscoveryPreference } from '@fuzl/planning';
type Row = AssessedPlace | AssessedEvent;
const key = (r: Row) => workKey('candidate' in r ? r.candidate : r.event);
export function travelRanking<T extends Row>(baseline: readonly T[], enabled: boolean, preference: DiscoveryPreference) {
  const ordered = [...baseline], moved = new Set<string>();
  const tier = (r: T) => JSON.stringify([r.status, r.memory?.boost ?? 0, 'ranking' in r ? r.ranking.slice(0,2) : r.event.providerStatus, preference === 'familiar' ? r.discovery?.favorite : preference === 'new' ? r.discovery?.visit === 'no-recorded-visit' : null, r.checks.map(c => [c.kind,c.status,c.blocking]).sort()]);
  if(enabled) for(let i=0;i<ordered.length-1;i++) {const a=ordered[i],b=ordered[i+1];if(a.status==='fits'&&b.status==='fits'&&tier(a)===tier(b)&&b.travelBalance?.includes(key(a))) {ordered[i]=b;ordered[i+1]=a;moved.add(key(b));i++;}}
  return { ordered, moved, notice: !enabled ? 'Balance travel is off.' : moved.size ? 'Helps balance travel across recent outings. Comparable verified options move at most one position; firm limits and discovery preferences stay in force.' : 'Keeping the ordinary order: no supported improvement between comparable verified options. Travel balancing needs reviewed current estimates and at least two comparable recent outings for every intended attendee.' };
}
