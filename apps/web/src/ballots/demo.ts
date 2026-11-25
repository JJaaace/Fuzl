import { newRecordId } from '@fuzl/planning';
import { ballotPublishSchema, ballotTallySchema, shortlistSaveSchema, voteCreateSchema, voteEditSchema } from '@fuzl/planning';
import type { BallotDashboard, BallotTally, OwnVote } from '@fuzl/planning';
// UI-only simulator. No network, authentication or database claims. Real route
// and permission checks are covered separately on disposable PostgreSQL.
export function ballotDemo(onPublished: (token: string) => void) {
  let draft: BallotDashboard['shortlist'] = null;
  const ballots: (BallotTally & { token: string; publicationId: string; votes: Map<string, OwnVote & { submissionId: string; lastRequestId?: string }> })[] = [];
  const dashboard = (): BallotDashboard => ({ shortlist: structuredClone(draft), ballots: ballots.map(b => ballotTallySchema.parse({ ...publicView(b), revision: b.revision, totalResponses: b.totalResponses, counts: b.counts })) });
  const refresh = () => { for (const b of ballots) { b.totalResponses = b.votes.size; b.counts = b.options.map(o => ({ optionId: o.id, votes: [...b.votes.values()].filter(v => v.optionId === o.id).length })); } };
  const owner = async (path: string, method: string, body?: unknown): Promise<unknown> => {
    void method;
    if (!path) { refresh(); return dashboard(); }
    if (path === '/shortlist') { const p = shortlistSaveSchema.parse(body); if ((draft?.revision ?? 0) !== p.revision) throw Error('Demo shortlist revision changed. Reload deliberately.'); draft = { content: p.content, revision: (draft?.revision ?? 0) + 1 }; return structuredClone(draft); }
    if (path === '/publish') {
      const p = ballotPublishSchema.parse(body), previous = ballots[0];
      const repeated = ballots.find(b => b.publicationId === p.publicationId); if (repeated) return { ballot: publicView(repeated), token: repeated.token };
      if (!draft || !draft.content.options.length || draft.revision !== p.shortlistRevision || (previous?.id ?? null) !== p.expectedBallotId) throw Error('Save and preview the current demo shortlist first.');
      const version = (previous?.version ?? 0) + 1;
      if (previous) { previous.state = 'superseded'; previous.supersededByVersion = version; previous.revision++; }
      const b = { ...structuredClone(draft.content), id: newRecordId(), version, revision: 1, state: 'open' as const, expiresAt: new Date(Date.now() + p.days * 86400000).toISOString(), supersededByVersion: null, counts: draft.content.options.map(o => ({ optionId: o.id, votes: 0 })), totalResponses: 0, votes: new Map(), token: p.inviteToken, publicationId: p.publicationId };
      ballots.unshift(b); onPublished(p.inviteToken); return { ballot: publicView(b), token: b.token };
    }
    const b = ballots.find(b => path.includes(b.id)); if (!b) throw Error('Demo ballot unavailable'); b.state = path.endsWith('/close') ? 'closed' : 'revoked'; b.revision++; return undefined;
  };
  const publicView = (b: BallotTally) => ({ id: b.id, version: b.version, title: b.title, options: structuredClone(b.options), state: b.state, expiresAt: b.expiresAt, supersededByVersion: b.supersededByVersion });
  const guest = async (path: string, token: string, signal: AbortSignal, method = 'GET', body?: unknown, invite?: string): Promise<unknown> => {
    void signal;
    const b = ballots.find(b => b.token === (path === '/vote' ? invite : token));
    if (!b || b.state === 'revoked' || Date.parse(b.expiresAt) <= Date.now()) throw Error('Demo ballot expired or revoked.');
    if (path === '/form') return publicView(b);
    if (path === '/vote' && method === 'GET') { const v = b.votes.get(token); return v ? { optionId: v.optionId, revision: v.revision, updatedAt: v.updatedAt } : null; }
    if (b.state !== 'open') throw Error('Voting is closed for this version.');
    if (path === '/votes') { const p = voteCreateSchema.parse(body); const old = b.votes.get(p.editToken); if (old) return { optionId: old.optionId, revision: old.revision, updatedAt: old.updatedAt }; if (!b.options.some(o => o.id === p.optionId)) throw Error('Unknown option'); const v = { optionId: p.optionId, revision: 1, updatedAt: new Date().toISOString() }; b.votes.set(p.editToken, { ...v, submissionId: p.submissionId }); refresh(); return v; }
    const p = voteEditSchema.parse(body), old = b.votes.get(token); if (!old || old.revision !== p.revision && old.lastRequestId !== p.requestId) throw Error('Demo vote revision changed.'); const v = { optionId: p.optionId, revision: old.lastRequestId === p.requestId ? old.revision : old.revision + 1, updatedAt: new Date().toISOString() }; b.votes.set(token, { ...v, submissionId: old.submissionId, lastRequestId: p.requestId }); refresh(); return v;
  };
  return { owner, guest };
}
