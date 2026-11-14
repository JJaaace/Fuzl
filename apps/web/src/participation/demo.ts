import { availabilityFor, scopeDashboardSchema, participationFixture } from '@fuzl/planning';
import type { OptInChoice, ScopeDashboard } from '@fuzl/planning';
import type { ParticipationRequest } from './ParticipationPanel';
import type { ScopeGuestRequest } from './ScopeReply';
// Explicit synthetic transport, not an authentication/database implementation.
export function participationDemo(notify: () => void, withReplies = true) {
  const f = participationFixture(); let revision = 1, generation = 1, mode: 'everyone' | 'available' = 'everyone', active = true, reviewed = true, selected: string[] = [];
  const replies = withReplies ? f.summary.participants.slice(0, 5).map((p, i) => ({ responseId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, alias: p.name!, revision: 1, currentWindow: true, choice: i === 4 ? 'no' as OptInChoice : 'yes' as OptInChoice, optInRevision: 1 })) : [];
  let mappings = replies.map((r, i) => ({ responseId: r.responseId, participantId: f.summary.participants[i].id }));
  const get = (): ScopeDashboard => scopeDashboardSchema.parse({ revision, sessionRevision: 1, mappings, selected, replies, active, scope: { mode, attendeeCount: mode === 'everyone' ? 6 : selected.length, roster: f.summary.participants.map(p => ({ ...p, selected: mode === 'everyone' || selected.includes(p.id), availability: availabilityFor(f.summary, p.id, f.window, active ? replies.find(r => mappings.some(m => m.responseId === r.responseId && m.participantId === p.id))?.choice : undefined) })), window: f.window, expiresAt: active ? '2026-11-15T02:00:00.000Z' : '2000-01-01T00:00:00.000Z', reviewed: mode === 'everyone' || reviewed && active, key: generation.toString(16).padStart(64, '0') } });
  const records = new Map<string, unknown>();
  const request: ParticipationRequest = async (path, method, raw) => {
    if (method === 'GET') return get(); const body = raw as { requestId: string; revision: number; expectedKey: string; mappings: typeof mappings; selected: string[]; mode: typeof mode };
    if (records.has(body.requestId)) return structuredClone(records.get(body.requestId));
    if (body.revision !== revision) throw Error('Synthetic scope revision changed. Refresh and review.');
    if (path === '/review') { if (body.expectedKey !== get().scope.key) throw Error('Synthetic replies changed; refresh and review.'); if (body.mode === 'available' && (!active || !body.selected.length || body.selected.some(id => !body.mappings.some(m => m.participantId === id && replies.some(r => r.responseId === m.responseId && r.choice === 'yes'))))) throw Error('Only explicit current Yes responses can join this subset.'); mappings = body.mappings; selected = body.selected; mode = body.mode; reviewed = true; }
    else if (path === '/revoke') { active = false; mode = 'everyone'; }
    else throw Error('The fixture already includes one window; create new real windows in a saved session after migration.');
    revision++; generation++; const result = get(); records.set(body.requestId, structuredClone(result)); notify(); return result;
  };
  const guests = replies.map(r => {
    const attempts = new Map<string, unknown>();
    const request: ScopeGuestRequest = async (method, raw) => { const own = () => ({ choice: r.choice, revision: r.optInRevision, updatedAt: '2026-11-14T22:00:00Z' }); if (!active) throw Error('Synthetic opt-in window expired or revoked.'); if (method === 'GET') return own(); const input = raw as { revision: number; choice: OptInChoice; requestId: string }; if (attempts.has(input.requestId)) return attempts.get(input.requestId); if (input.revision !== r.optInRevision) throw Error('Own synthetic response changed; reload.'); r.choice = input.choice; r.optInRevision++; generation++; reviewed = false; const result = own(); attempts.set(input.requestId, result); notify(); return result; }; return { name: r.alias, request };
  });
  return { get, request, guests, expire() { active = false; generation++; reviewed = false; notify(); } };
}
