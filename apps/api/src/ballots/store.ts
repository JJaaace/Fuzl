import { timingSafeEqual } from 'node:crypto';
import { ballotDashboardSchema, ballotViewSchema, guestTokenSchema, shortlistContentSchema, voteSchema } from '@fuzl/planning';
import type { BallotPublish, BallotView, ShortlistContent } from '@fuzl/planning';
import type { Ballot, Prisma, PrismaClient } from '../generated/prisma/client.js';
import { digest } from '../guests/store.js';
import { ExtractionError } from '../extraction/errors.js';
const unavailable = () => new ExtractionError(404, 'ballot_unavailable', 'This ballot or vote is unavailable, expired or revoked. Ask the organizer for a current link.');
const conflict = () => new ExtractionError(409, 'ballot_conflict', 'This version changed. Refresh and review the current version; your draft was kept.');
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const scope = (subject: string, id: string) => ({ id, group: { owner: { authSubject: subject } } });
export class BallotStore {
  constructor(private db: PrismaClient, private now = Date.now) {}
  private async owner(tx: Prisma.TransactionClient, subject: string, sessionId: string, lock = false) {
    let row = await tx.planningSession.findFirst({ where: scope(subject, sessionId), select: { id: true, revision: true } });
    if (!row) throw unavailable();
    if (lock) { await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`; row = await tx.planningSession.findFirst({ where: scope(subject, sessionId), select: { id: true, revision: true } }); }
    if (!row) throw unavailable(); return row;
  }
  private view(b: Ballot): BallotView {
    return ballotViewSchema.parse({ id: b.id, version: b.version, ...shortlistContentSchema.parse(b.content), state: b.revokedAt ? 'revoked' : b.expiresAt.getTime() <= this.now() ? 'expired' : b.supersededByVersion ? 'superseded' : b.closedAt ? 'closed' : 'open', expiresAt: b.expiresAt.toISOString(), supersededByVersion: b.supersededByVersion });
  }
  async dashboard(subject: string, sessionId: string) {
    await this.owner(this.db, subject, sessionId);
    const draft = await this.db.ballotShortlist.findUnique({ where: { sessionId } });
    const rows = await this.db.ballot.findMany({ where: { session: scope(subject, sessionId) }, orderBy: { version: 'desc' }, take: 30, include: { votes: { select: { optionId: true } } } });
    return ballotDashboardSchema.parse({ shortlist: draft ? { content: draft.content, revision: draft.revision } : null, ballots: rows.map(row => ({ ...this.view(row), revision: row.revision, totalResponses: row.votes.length, counts: shortlistContentSchema.parse(row.content).options.map(o => ({ optionId: o.id, votes: row.votes.filter(v => v.optionId === o.id).length })) })) });
  }
  async save(subject: string, sessionId: string, input: { content: ShortlistContent; revision: number; sessionRevision: number }) {
    return this.db.$transaction(async tx => {
      const session = await this.owner(tx, subject, sessionId, true);
      if (session.revision !== input.sessionRevision) throw conflict();
      const old = await tx.ballotShortlist.findUnique({ where: { sessionId } });
      const content = shortlistContentSchema.parse(input.content);
      if (old && JSON.stringify(shortlistContentSchema.parse(old.content)) === JSON.stringify(content)) return { content, revision: old.revision };
      if ((old?.revision ?? 0) !== input.revision) throw conflict();
      const saved = old ? await tx.ballotShortlist.update({ where: { sessionId }, data: { content: json(content), revision: { increment: 1 } } }) : await tx.ballotShortlist.create({ data: { sessionId, content: json(content) } });
      return { content, revision: saved.revision };
    });
  }
  async publish(subject: string, sessionId: string, input: BallotPublish) {
    return this.db.$transaction(async tx => {
      const session = await this.owner(tx, subject, sessionId, true);
      const repeated = await tx.ballot.findUnique({ where: { sessionId_publicationId: { sessionId, publicationId: input.publicationId } } });
      if (repeated) { if (!same(repeated.tokenDigest, digest(input.inviteToken))) throw conflict(); return { ballot: this.view(repeated), token: input.inviteToken }; }
      if (session.revision !== input.sessionRevision) throw conflict();
      const previous = await tx.ballot.findFirst({ where: { currentSessionId: sessionId } });
      if ((previous?.id ?? null) !== input.expectedBallotId) throw conflict();
      const draft = await tx.ballotShortlist.findUnique({ where: { sessionId } });
      if (!draft || draft.revision !== input.shortlistRevision) throw conflict();
      const content = shortlistContentSchema.parse(draft.content);
      if (!content.options.length) throw new ExtractionError(400, 'empty_ballot', 'Choose one to three options before publishing.');
      const version = (previous?.version ?? 0) + 1;
      if (version > 30) throw new ExtractionError(429, 'ballot_version_limit', 'This session has reached its 30-ballot limit.');
      if (previous) {
        // Serialize against vote submissions: after revision, an old credential
        // can read its closed version but cannot vote on the revised ballot.
        await tx.$queryRaw`SELECT id FROM fuzl.fuzl_ballots WHERE id = ${previous.id}::uuid FOR UPDATE`;
        await tx.ballot.update({ where: { id: previous.id }, data: { currentSessionId: null, closedAt: new Date(this.now()), supersededByVersion: version, revision: { increment: 1 } } });
      }
      const row = await tx.ballot.create({ data: { sessionId, currentSessionId: sessionId, publicationId: input.publicationId, version, tokenDigest: digest(input.inviteToken), content: json(content), expiresAt: new Date(this.now() + input.days * 86400000) } });
      return { ballot: this.view(row), token: input.inviteToken };
    });
  }
  async control(subject: string, sessionId: string, id: string, revision: number, action: 'close' | 'revoke') {
    await this.owner(this.db, subject, sessionId);
    return this.db.$transaction(async tx => {
      const row = await tx.ballot.findFirst({ where: { id, session: scope(subject, sessionId) } });
      if (!row) throw unavailable();
      await tx.$queryRaw`SELECT id FROM fuzl.fuzl_ballots WHERE id = ${id}::uuid FOR UPDATE`;
      const latest = await tx.ballot.findUniqueOrThrow({ where: { id } });
      if (action === 'close' && latest.closedAt || action === 'revoke' && latest.revokedAt) return;
      if (latest.revision !== revision) throw conflict();
      await tx.ballot.update({ where: { id }, data: { ...(action === 'close' ? { closedAt: new Date(this.now()) } : { revokedAt: new Date(this.now()) }), revision: { increment: 1 } } });
    });
  }
  private async invite(tx: Prisma.TransactionClient, token: string, lock = false) {
    if (!guestTokenSchema.safeParse(token).success) throw unavailable();
    let b = await tx.ballot.findUnique({ where: { tokenDigest: digest(token) } });
    if (!b) throw unavailable();
    if (lock) { await tx.$queryRaw`SELECT id FROM fuzl.fuzl_ballots WHERE id = ${b.id}::uuid FOR UPDATE`; b = await tx.ballot.findUnique({ where: { id: b.id } }); }
    if (!b || b.revokedAt || b.expiresAt.getTime() <= this.now()) throw unavailable();
    return b;
  }
  async form(token: string) { return this.view(await this.invite(this.db, token)); }
  private async own(tx: Prisma.TransactionClient, ballotId: string, editToken: string) {
    if (!guestTokenSchema.safeParse(editToken).success) throw unavailable();
    return tx.ballotVote.findFirst({ where: { ballotId, editDigest: digest(editToken) } });
  }
  private dto(row: { optionId: string; revision: number; updatedAt: Date }) { return voteSchema.parse({ optionId: row.optionId, revision: row.revision, updatedAt: row.updatedAt.toISOString() }); }
  async readOwn(token: string, editToken: string) { const b = await this.invite(this.db, token), row = await this.own(this.db, b.id, editToken); return row ? this.dto(row) : null; }
  private open(b: Ballot, optionId: string) {
    if (this.view(b).state !== 'open') throw new ExtractionError(409, 'voting_closed', 'Voting is closed for this ballot version. Earlier votes do not transfer to a revised ballot.');
    if (!shortlistContentSchema.parse(b.content).options.some(o => o.id === optionId)) throw new ExtractionError(400, 'invalid_vote_option', 'Choose an option from this ballot version.');
  }
  async submit(token: string, input: { submissionId: string; editToken: string; optionId: string }) {
    return this.db.$transaction(async tx => {
      const b = await this.invite(tx, token, true);
      this.open(b, input.optionId);
      if (same(digest(input.editToken), b.tokenDigest)) throw new ExtractionError(400, 'separate_vote_permission', 'Use a separate private vote-edit credential.');
      const existing = await tx.ballotVote.findUnique({ where: { ballotId_submissionId: { ballotId: b.id, submissionId: input.submissionId } } });
      if (existing) { if (!same(existing.editDigest, digest(input.editToken))) throw unavailable(); return this.dto(existing); }
      if (await this.own(tx, b.id, input.editToken)) throw unavailable();
      if (await tx.ballotVote.count({ where: { ballotId: b.id } }) >= 200) throw new ExtractionError(429, 'vote_limit', 'This ballot has reached its 200-response limit.');
      return this.dto(await tx.ballotVote.create({ data: { ballotId: b.id, submissionId: input.submissionId, editDigest: digest(input.editToken), optionId: input.optionId } }));
    });
  }
  async edit(token: string, editToken: string, input: { revision: number; requestId: string; optionId: string }) {
    return this.db.$transaction(async tx => {
      const b = await this.invite(tx, token, true); this.open(b, input.optionId);
      const old = await this.own(tx, b.id, editToken); if (!old) throw unavailable();
      if (old.lastRequestId === input.requestId) { if (old.optionId !== input.optionId) throw conflict(); return this.dto(old); }
      if (old.revision !== input.revision) throw conflict();
      return this.dto(await tx.ballotVote.update({ where: { id: old.id }, data: { optionId: input.optionId, revision: { increment: 1 }, lastRequestId: input.requestId } }));
    });
  }
}
