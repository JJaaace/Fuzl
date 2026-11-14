import { participationContext } from '../participation/store.js';
import { scopeWindowSchema, summaryForScope } from '@fuzl/planning';
import type { ParticipationScope, PlanningSummary } from '@fuzl/planning';
import { ideaVersions } from '../ideas/store.js';
import { groupMemories, groupVisitHistory } from '../outings/store.js';
import type { GroupMemory, GroupVisitHistory } from '@fuzl/planning';
import { createHash } from 'node:crypto';
import { sessionInputSchema } from '@fuzl/planning';
import type { PlaceSearch, PrivateSpending } from '@fuzl/planning';
import type { PrismaClient } from '../generated/prisma/client.js';
import { validateGuestOrigins } from '../guests/store.js';
import { ExtractionError } from '../extraction/errors.js';
export interface SearchContext { participation?: ParticipationScope; checkingSummary?: PlanningSummary; visitHistory?: GroupVisitHistory; privateSpending: PrivateSpending[]; memories?: GroupMemory[]; baselineVersion?: string; version: string }
export interface PlaceContextStore { context(subject: string, sessionId: string, request: Pick<PlaceSearch, 'summary' | 'sessionRevision'> & { query?: unknown }): Promise<SearchContext> }
export class PlaceStore implements PlaceContextStore {
  constructor(private db: PrismaClient, private now = Date.now) {}
  async context(subject: string, sessionId: string, request: Pick<PlaceSearch, 'summary' | 'sessionRevision'> & { query?: unknown }): Promise<SearchContext> {
    return this.db.$transaction(async tx => {
      const session = await tx.planningSession.findFirst({ where: { id: sessionId, group: { owner: { authSubject: subject } } } });
      if (!session) throw new ExtractionError(404, 'not_found', 'This saved session is unavailable for this account.');
      if (session.revision !== request.sessionRevision) throw new ExtractionError(409, 'places_stale_session', 'The saved session changed. Reopen its latest version before searching; local edits were kept.');
      const previous = sessionInputSchema.parse({ title: session.title, origin: session.origin, summaryVersion: session.summaryVersion, summary: session.summary, provenance: session.provenance });
      await validateGuestOrigins(tx, subject, { ...previous, summary: request.summary }, previous, sessionId);
      // All retained private answers remain conservative session limits. Never
      // join aliases or return rows, thresholds, IDs or this internal fingerprint.
      const rows = await tx.guestPrivateAnswer.findMany({ where: { response: { invite: { session: { id: sessionId, group: { owner: { authSubject: subject } } } } } }, select: { id: true, responseId: true, state: true, amount: true, currency: true, response: { select: { revision: true } } }, orderBy: { id: 'asc' } });
      // PlaceQuery has extra fields: build only the exact window allowlist.
      const q = request.query as { date?: unknown; start?: unknown; end?: unknown; timeZone?: unknown } | undefined;
      const window = q ? scopeWindowSchema.safeParse({ date: q.date, start: q.start, end: q.end, timeZone: q.timeZone }) : scopeWindowSchema.safeParse(undefined);
      const participation = await participationContext(tx, sessionId, request.summary, session.revision, this.now(), window.success ? window.data : undefined);
      if (participation.scope.mode === 'available' && (!participation.scope.reviewed || JSON.stringify((session.summary as unknown as PlanningSummary).participants) !== JSON.stringify(request.summary.participants))) throw new ExtractionError(409, 'scope_review_required', 'Opt-ins expired or the roster/replies/session changed. Refresh and explicitly review the attendance scope before checking options.');
      const excluded = new Set(participation.scope.roster.filter(p => !p.selected).map(p => p.id));
      const retained = rows.filter(r => participation.scope.mode !== 'available' || !participation.mappings.some(m => m.responseId === r.responseId && excluded.has(m.participantId)));
      const ideas = await ideaVersions(tx, session.groupId);
      const memory = await groupMemories(tx, session.groupId);
      const visits = await groupVisitHistory(tx, session.groupId);
      return { participation: participation.scope, checkingSummary: summaryForScope(request.summary, participation.scope), baselineVersion: createHash('sha256').update(JSON.stringify([session.revision, rows, memory.fingerprint, visits.fingerprint])).digest('hex'), visitHistory: visits.history, memories: memory.memories, privateSpending: retained.map(r => ({ state: r.state, amount: r.amount === null ? null : Number(r.amount), currency: r.currency })), version: createHash('sha256').update(JSON.stringify([session.revision, rows, participation.scope.key, memory.fingerprint, visits.fingerprint, ideas])).digest('hex') };
    });
  }
}
