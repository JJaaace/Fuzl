import { demoPlaces, demoPlaceQuery, demoPlaceSummary } from './place-fixtures.js';
import { emptyIdea, ideaPlace } from './ideas.js';
import type { GroupMemory } from './memory.js';
import type { GroupVisitHistory } from './discovery.js';
// Manually authored synthetic data: two group contexts, never provider output.
export function discoveryFixture(group: 'a' | 'b' = 'a') {
  const found = demoPlaces(demoPlaceQuery, '2026-11-14T12:00:00.000Z');
  if (!('area' in found)) throw Error('Expected resolved synthetic area');
  const base = found.candidates[0];
  const favorite = { ...base, id: 'favorite', name: 'Synthetic favorite garden', sourceUrl: 'https://example.com/discovery/favorite', price: { ...base.price, amount: 5 }, hours: { ...base.hours, kind: 'unknown' as const, date: null, start: null, end: null, timeZone: null } };
  const saved = ideaPlace({ id: `00000000-0000-4000-8000-00000000000${group === 'a' ? '1' : '2'}`, groupId: `00000000-0000-4000-8000-00000000000${group === 'a' ? '3' : '4'}`, revision: 1, content: { ...emptyIdea(), name: 'Synthetic saved night market', link: 'https://example.com/discovery/market', note: 'PRIVATE synthetic organizer note', category: 'park', lat: base.lat, lon: base.lon, address: base.address, timeZone: base.timeZone ?? null, lastCheckedOn: '2026-11-07' }, origin: { provider: 'demo', itemId: 'saved-market', referenceUrl: 'https://example.com/discovery/market' }, archived: false, edited: false, dateState: 'ongoing', createdAt: base.retrievedAt, updatedAt: base.retrievedAt });
  const mixed = { ...favorite, id: 'mixed', name: 'Synthetic mixed-feedback cafe', sourceUrl: 'https://example.com/discovery/mixed', category: 'cafe' as const };
  const expensive = { ...favorite, id: 'expensive', name: 'Synthetic over-budget favorite', sourceUrl: 'https://example.com/discovery/expensive', price: { ...favorite.price, amount: 99 } };
  const memories: GroupMemory[] = group === 'a' ? [favorite, mixed, expensive].map(c => ({ sourceUrl: c.sourceUrl, date: '2026-11-07', takeaway: c === mixed ? 'Some would return and some would not.' : 'The attending group enjoyed this outing.', sentiment: c === mixed ? 'mixed' : 'positive' })) : [];
  const history: GroupVisitHistory = { sourceUrls: group === 'a' ? [favorite.sourceUrl!, mixed.sourceUrl!, expensive.sourceUrl!] : [], uncertain: false };
  return { found: { area: found.area, candidates: [favorite, saved, mixed, expensive] }, memories, history, query: demoPlaceQuery, summary: demoPlaceSummary() };
}
