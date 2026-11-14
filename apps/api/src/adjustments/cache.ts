import { createHash, randomUUID } from 'node:crypto';
import type { WorkCandidates, WorkSuggestion } from '@fuzl/planning';
import { ExtractionError } from '../extraction/errors.js';
function canonical(v: unknown): unknown { return Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : v; }
export const workHash = (v: unknown) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
interface Snapshot { mode: 'demo' | 'live'; subject: string; sessionId: string; revision: number; contextVersion: string; summaryKey: string; context: WorkCandidates; created: number }
interface Preview { subject: string; sessionId: string; snapshotId: string; requestKey: string; suggestions: WorkSuggestion[]; created: number; decisions: Map<string, { id: string; recordedAt: string }> }
const stale = () => new ExtractionError(410, 'adjustment_expired', 'This search or adjustment preview expired, was replaced, or belongs to another session/account. Your edits were kept; recheck the current options.');
export class AdjustmentCache {
  private snapshots = new Map<string, Snapshot>();
  private previews = new Map<string, Preview>();
  constructor(private now = Date.now) {}
  private prune() { for (const map of [this.snapshots, this.previews]) { for (const [id, v] of map) if (this.now() - v.created >= 600000) map.delete(id); } }
  put(value: Omit<Snapshot, 'created'>) {
    this.prune(); while (this.snapshots.size >= 50) this.snapshots.delete(this.snapshots.keys().next().value!);
    for (const [id, v] of this.snapshots) if (v.subject === value.subject && v.sessionId === value.sessionId && v.context.kind === value.context.kind) this.snapshots.delete(id);
    const id = randomUUID(); this.snapshots.set(id, structuredClone({ ...value, created: this.now() })); return id;
  }
  get(id: string, subject: string, sessionId: string) { this.prune(); const v = this.snapshots.get(id); if (!v || v.subject !== subject || v.sessionId !== sessionId) throw stale(); return v; }
  preview(subject: string, sessionId: string, snapshotId: string, requestKey: string, suggestions: WorkSuggestion[]) { this.prune(); while (this.previews.size >= 50) this.previews.delete(this.previews.keys().next().value!); const id = randomUUID(); this.previews.set(id, { subject, sessionId, snapshotId, requestKey, suggestions: structuredClone(suggestions), created: this.now(), decisions: new Map() }); return id; }
  getPreview(id: string, subject: string, sessionId: string) { this.prune(); const v = this.previews.get(id); if (!v || v.subject !== subject || v.sessionId !== sessionId) throw stale(); this.get(v.snapshotId, subject, sessionId); return v; }
  decision(v: Preview, suggestion: string) { let d = v.decisions.get(suggestion); if (!d) { d = { id: randomUUID(), recordedAt: new Date(this.now()).toISOString() }; v.decisions.set(suggestion, d); } return d; }
}
