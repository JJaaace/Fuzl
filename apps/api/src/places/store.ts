import { createHash } from 'node:crypto';
import { sessionInputSchema } from '@fuzl/planning';
import type { PlaceSearch, PrivateSpending } from '@fuzl/planning';
import type { PrismaClient } from '../generated/prisma/client.js';
import { validateGuestOrigins } from '../guests/store.js';
import { ExtractionError } from '../extraction/errors.js';
export interface SearchContext { privateSpending: PrivateSpending[]; version: string }
export interface PlaceContextStore { context(subject: string, sessionId: string, request: PlaceSearch): Promise<SearchContext> }
export class PlaceStore implements PlaceContextStore {
  constructor(private db: PrismaClient) {}
  async context(subject: string, sessionId: string, request: PlaceSearch): Promise<SearchContext> {
    return this.db.$transaction(async tx => {
      const session = await tx.planningSession.findFirst({ where: { id: sessionId, group: { owner: { authSubject: subject } } } });
      if (!session) throw new ExtractionError(404, 'not_found', 'This saved session is unavailable for this account.');
      if (session.revision !== request.sessionRevision) throw new ExtractionError(409, 'places_stale_session', 'The saved session changed. Reopen its latest version before searching; local edits were kept.');
      const previous = sessionInputSchema.parse({ title: session.title, origin: session.origin, summaryVersion: session.summaryVersion, summary: session.summary, provenance: session.provenance });
      await validateGuestOrigins(tx, subject, { ...previous, summary: request.summary }, previous, sessionId);
      // All retained private answers remain conservative session limits. Never
      // join aliases or return rows, thresholds, IDs or this internal fingerprint.
      const rows = await tx.guestPrivateAnswer.findMany({ where: { response: { invite: { session: { id: sessionId, group: { owner: { authSubject: subject } } } } } }, select: { id: true, state: true, amount: true, currency: true, response: { select: { revision: true } } }, orderBy: { id: 'asc' } });
      return { privateSpending: rows.map(r => ({ state: r.state, amount: r.amount === null ? null : Number(r.amount), currency: r.currency })), version: createHash('sha256').update(JSON.stringify([session.revision, rows])).digest('hex') };
    });
  }
}
