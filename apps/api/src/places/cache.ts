import { randomUUID } from 'node:crypto';
import type { PlaceCandidate, PlaceArea, PlaceSearch } from '@fuzl/planning';
import { ExtractionError } from '../extraction/errors.js';
interface Snapshot { subject: string; sessionId: string; revision: number; contextVersion: string; queryKey: string; candidates: PlaceCandidate[]; area: PlaceArea; mode: 'demo' | 'live'; created: number }
export const searchBoundaryKey = (query: PlaceSearch['query']) => JSON.stringify([query.area.trim(), query.resolutionId ?? null, query.radiusKm, query.category]);
// Public venue baselines only. No conversations, summary, budgets or aliases.
export class PlaceSearchCache {
  private entries = new Map<string, Snapshot>();
  constructor(private now = Date.now) {}
  put(value: Omit<Snapshot, 'created'>) {
    this.prune();
    while (this.entries.size >= 50) this.entries.delete(this.entries.keys().next().value!);
    const id = randomUUID(); this.entries.set(id, { ...value, created: this.now() }); return id;
  }
  private prune() { for (const [id, value] of this.entries) if (this.now() - value.created >= 600000) this.entries.delete(id); }
  get(id: string, subject: string, sessionId: string) {
    this.prune(); const value = this.entries.get(id);
    if (!value || value.subject !== subject || value.sessionId !== sessionId) throw new ExtractionError(410, 'places_snapshot_unavailable', 'This search expired or is unavailable for this account/session. Recorded details were kept; run a deliberate search again.');
    return value;
  }
}
