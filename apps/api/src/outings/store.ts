import { Prisma as PrismaValue } from '../generated/prisma/client.js';
import { createHash } from 'node:crypto';
import { pastOutingsSchema, actualOutingSchema, memoryOpinionSchema, ballotSourceUrl, feedbackSentiment, outingOwnerSchema, ownFeedbackSchema, planDraftSchema, publicOutingSchema, localInstant } from '@fuzl/planning';
import type { GroupVisitHistory, GroupMemory, recordOutingSchema, outingEditSchema, memoryEditSchema, feedbackCreateSchema, feedbackEditSchema } from '@fuzl/planning';
import type { z } from 'zod';
import type { Outing, OutingFeedback, Prisma, PrismaClient } from '../generated/prisma/client.js';
import { ExtractionError } from '../extraction/errors.js';
import { digest } from '../guests/store.js';
import { PlanStore } from '../plans/store.js';
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const scope = (subject: string, sessionId: string) => ({ id: sessionId, group: { owner: { authSubject: subject } } });
const unavailable = () => new ExtractionError(404, 'outing_unavailable', 'This outing or feedback is unavailable. Use a current shared plan link.');
const changed = () => new ExtractionError(409, 'outing_changed', 'The outing or feedback changed. Your entries were kept; reload and review before retrying.');
export class OutingStore {
  constructor(private db: PrismaClient, private now = Date.now) {}
  private dto(row: Outing & { feedback: OutingFeedback[]; plan: { sessionId: string } }) {
    return outingOwnerSchema.parse({ id: row.id, revision: row.revision, actual: row.actual, original: row.original, originalVersion: row.originalVersion, sameListing: row.sameListing, confirmedAttendees: row.confirmedAttendees, feedbackVersion: row.feedbackVersion, privateNotes: row.privateNotes, proposedTakeaway: row.proposedTakeaway, approvedTakeaway: row.approvedTakeaway, sessionId: row.plan.sessionId, feedback: row.feedback.map(f => ({ id: f.id, ...this.ownDto(f, row.actualVersion) })), memoryActive: row.approvedTakeaway !== null && row.approvedFeedbackVersion === row.feedbackVersion, createdAt: row.createdAt.toISOString() });
  }
  private ownDto(row: OutingFeedback, actualVersion: number) { return ownFeedbackSchema.parse({ answers: row.answers, needsReview: row.actualVersion !== actualVersion, revision: row.revision, updatedAt: row.updatedAt.toISOString() }); }
  private async owner(tx: Prisma.TransactionClient, subject: string, sessionId: string, lock = false) {
    const session = await tx.planningSession.findFirst({ where: scope(subject, sessionId) }); if (!session) throw unavailable();
    if (lock) await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const plan = await tx.sharedPlan.findUnique({ where: { sessionId } }); if (!plan) return null;
    if (lock) await tx.$queryRaw`SELECT id FROM fuzl.fuzl_shared_plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
    return tx.sharedPlan.findUniqueOrThrow({ where: { id: plan.id } });
  }
  async get(subject: string, sessionId: string) {
    const p = await this.owner(this.db, subject, sessionId); if (!p) return null;
    const row = await this.db.outing.findFirst({ where: { planId: p.id, plan: { session: scope(subject, sessionId) } }, include: { feedback: { orderBy: { updatedAt: 'desc' }, take: 200 }, plan: { select: { sessionId: true } } } });
    return row ? this.dto(row) : null;
  }
  async past(subject: string, groupId: string) {
    if (!await this.db.group.findFirst({ where: { id: groupId, owner: { authSubject: subject } } })) throw unavailable();
    // Order the bounded result in SQL by the recorded actual local date/time,
    // not creation time. Only active approved text and explicit entry counts
    // leave this query; individual feedback/names/travel are never selected.
    const rows = await this.db.$queryRaw<unknown[]>`
      SELECT o.id, p."sessionId", o.actual,
        CASE WHEN o."approvedFeedbackVersion" = o."feedbackVersion"
          THEN o."approvedTakeaway" ELSE NULL END AS "approvedTakeaway",
        COALESCE(o."approvedTakeaway" IS NOT NULL AND o."approvedFeedbackVersion" = o."feedbackVersion", false) AS "memoryActive",
        jsonb_array_length(o."confirmedAttendees") AS "organizerAttendanceCount"
      FROM fuzl.fuzl_outings o
      JOIN fuzl.fuzl_shared_plans p ON p.id = o."planId"
      JOIN fuzl.fuzl_groups g ON g.id = o."groupId"
      JOIN fuzl.fuzl_organizers a ON a.id = g."ownerId"
      WHERE o."groupId" = ${groupId}::uuid AND a."authSubject" = ${subject}::uuid AND p.status = 'completed'
      ORDER BY o.actual->>'date' DESC, o.actual->>'time' DESC, o.id DESC
      LIMIT 100
    `;
    return pastOutingsSchema.parse(rows);
  }
  private validateActual(input: z.infer<typeof outingEditSchema>) {
    const a = actualOutingSchema.parse(input.actual), instant = localInstant(a.date!, a.time!, a.timeZone!);
    if (instant === null || instant > this.now()) throw new ExtractionError(400, 'outing_future', 'Record an outing that actually happened. Its actual local date/time cannot be in the future.');
  }
  async complete(subject: string, sessionId: string, input: z.infer<typeof recordOutingSchema>) {
    this.validateActual(input); const fingerprint = hash(['complete', input]);
    await this.db.$transaction(async tx => {
      const p = await this.owner(tx, subject, sessionId, true); if (!p) throw unavailable();
      const old = await tx.outing.findUnique({ where: { planId: p.id } });
      if (old?.lastRequestId === input.requestId && old.lastRequestHash === fingerprint) return;
      if (old || p.revision !== input.revision) throw changed();
      if (!['confirmed', 'completed'].includes(p.status) || !p.publishedVersion) throw new ExtractionError(409, 'outing_not_confirmed', 'Only a published confirmed or previously completed plan can be recorded as an actual outing. Cancelled and proposed plans are not visits.');
      // Freeze the last confirmed publication, not a later unfinished draft.
      const original = await tx.planVersion.findFirst({ where: { planId: p.id, status: 'confirmed' }, orderBy: { version: 'desc' } }); if (!original) throw unavailable();
      const snapshot = planDraftSchema.parse(original.snapshot);
      const session = await tx.planningSession.findUniqueOrThrow({ where: { id: sessionId }, select: { groupId: true } });
      await tx.outing.create({ data: { planId: p.id, groupId: session.groupId, original: json(snapshot), originalVersion: original.version, actual: json(input.actual), sameListing: input.sameListing, confirmedAttendees: json(input.confirmedAttendees), lastRequestId: input.requestId, lastRequestHash: fingerprint } });
      if (p.status === 'confirmed') {
        if (p.publishedVersion >= 100) throw changed();
        await tx.planVersion.create({ data: { planId: p.id, version: p.publishedVersion + 1, materialVersion: p.materialVersion, status: 'completed', snapshot: json(snapshot), changeNotice: 'Plan completed. The organizer recorded what actually happened. Attendance is reported separately; feedback is optional.' } });
        await tx.sharedPlan.update({ where: { id: p.id }, data: { status: 'completed', publishedVersion: { increment: 1 }, revision: { increment: 1 }, lastRequestId: input.requestId, lastRequestHash: fingerprint } });
      }
    }); return this.get(subject, sessionId);
  }
  private async mutate(subject: string, sessionId: string, kind: string, input: { revision: number; requestId: string }, work: (tx: Prisma.TransactionClient, row: Outing) => Promise<void>) {
    const fingerprint = hash([kind, input]);
    await this.db.$transaction(async tx => {
      const p = await this.owner(tx, subject, sessionId, true); if (!p || p.status !== 'completed') throw unavailable();
      const row = await tx.outing.findUnique({ where: { planId: p.id } }); if (!row) throw unavailable();
      await tx.$queryRaw`SELECT id FROM fuzl.fuzl_outings WHERE id = ${row.id}::uuid FOR UPDATE`;
      const current = await tx.outing.findUniqueOrThrow({ where: { id: row.id } });
      if (current.lastRequestId === input.requestId) { if (current.lastRequestHash !== fingerprint) throw changed(); return; }
      if (current.revision !== input.revision) throw changed();
      await work(tx, current); await tx.outing.update({ where: { id: row.id }, data: { revision: { increment: 1 }, lastRequestId: input.requestId, lastRequestHash: fingerprint } });
    }); return this.get(subject, sessionId);
  }
  async editActual(subject: string, sessionId: string, input: z.infer<typeof outingEditSchema>) {
    this.validateActual(input);
    return this.mutate(subject, sessionId, 'actual', input, async (tx, row) => { await tx.outing.update({ where: { id: row.id }, data: { actual: json(input.actual), sameListing: input.sameListing, confirmedAttendees: json(input.confirmedAttendees), travelReview: PrismaValue.DbNull, actualVersion: { increment: 1 }, feedbackVersion: { increment: 1 }, approvedFeedbackVersion: null } }); });
  }
  async memory(subject: string, sessionId: string, input: z.infer<typeof memoryEditSchema>) {
    return this.mutate(subject, sessionId, 'memory', input, async (tx, row) => {
      if (row.feedbackVersion !== input.feedbackVersion) throw changed();
      await tx.outing.update({ where: { id: row.id }, data: { privateNotes: input.privateNotes, proposedTakeaway: input.proposedTakeaway, ...(input.action === 'notes' ? {} : { approvedTakeaway: input.approvedTakeaway, approvedFeedbackVersion: input.action === 'approve' ? row.feedbackVersion : null }) } });
    });
  }
  private async access(tx: Prisma.TransactionClient, token: string, lock = false) {
    const { plan, link } = await new PlanStore(this.db, this.now).access(tx, token, lock); if (plan.status !== 'completed') throw unavailable();
    const row = await tx.outing.findUnique({ where: { planId: plan.id } }); if (!row) throw unavailable();
    if (lock) await tx.$queryRaw`SELECT id FROM fuzl.fuzl_outings WHERE id = ${row.id}::uuid FOR UPDATE`;
    return { row: lock ? await tx.outing.findUniqueOrThrow({ where: { id: row.id } }) : row, link };
  }
  async page(token: string) { const { row } = await this.access(this.db, token); return publicOutingSchema.parse({ id: row.id, revision: row.actualVersion, actual: row.actual }); }
  async readOwn(token: string, edit: string) { const { row } = await this.access(this.db, token); const f = await this.db.outingFeedback.findUnique({ where: { outingId_editDigest: { outingId: row.id, editDigest: digest(edit) } } }); return f ? this.ownDto(f, row.actualVersion) : null; }
  async feedback(token: string, edit: string, input: z.infer<typeof feedbackCreateSchema> | z.infer<typeof feedbackEditSchema>) {
    return this.db.$transaction(async tx => {
      const { row, link } = await this.access(tx, token, true), fingerprint = hash(input), key = { outingId: row.id, editDigest: digest(edit) };
      if (key.editDigest === link.tokenDigest) throw new ExtractionError(400, 'separate_feedback_permission', 'Feedback needs a separate private edit credential.');
      const old = await tx.outingFeedback.findUnique({ where: { outingId_editDigest: key } });
      if ('submissionId' in input) {
        const prior = await tx.outingFeedback.findUnique({ where: { outingId_submissionId: { outingId: row.id, submissionId: input.submissionId } } });
        if (prior) { if (prior.editDigest !== key.editDigest) throw unavailable(); return this.ownDto(prior, row.actualVersion); }
        if (old) throw changed();
      } else {
        if (!old) throw unavailable();
        if (old.lastRequestId === input.requestId) { if (old.lastRequestHash !== fingerprint) throw changed(); return this.ownDto(old, row.actualVersion); }
        if (old.revision !== input.revision) throw changed();
      }
      if (row.actualVersion !== input.payload.outingRevision) throw changed();
      if (!old && await tx.outingFeedback.count({ where: { outingId: row.id } }) >= 200) throw new ExtractionError(429, 'feedback_limit', 'This outing has reached its 200-response limit.');
      const saved = 'submissionId' in input ? await tx.outingFeedback.create({ data: { ...key, actualVersion: row.actualVersion, submissionId: input.submissionId, answers: json(input.payload.answers), memoryOpinion: json({ attended: input.payload.answers.attended, allowMemory: input.payload.answers.allowMemory, again: input.payload.answers.again }) } }) : await tx.outingFeedback.update({ where: { id: old!.id }, data: { answers: json(input.payload.answers), memoryOpinion: json({ attended: input.payload.answers.attended, allowMemory: input.payload.answers.allowMemory, again: input.payload.answers.again }), actualVersion: row.actualVersion, revision: { increment: 1 }, lastRequestId: input.requestId, lastRequestHash: fingerprint } });
      // Any answer/consent change suspends approved use until explicit re-review.
      await tx.outing.update({ where: { id: row.id }, data: { feedbackVersion: { increment: 1 }, revision: { increment: 1 }, approvedFeedbackVersion: null } });
      return this.ownDto(saved, row.actualVersion);
    });
  }
}
// Called only inside an already-owned session context. No notes, aliases, raw
// answers or conversations leave this server-side calculation.
export async function groupMemories(tx: Prisma.TransactionClient, groupId: string): Promise<{ memories: GroupMemory[]; fingerprint: unknown }> {
  const rows = await tx.outing.findMany({ where: { groupId, plan: { status: 'completed' }, approvedTakeaway: { not: null } }, select: { id: true, revision: true, actualVersion: true, actual: true, sameListing: true, original: true, approvedTakeaway: true, feedbackVersion: true, approvedFeedbackVersion: true, feedback: { select: { memoryOpinion: true, actualVersion: true }, take: 200 } }, orderBy: { createdAt: 'desc' }, take: 100 });
  const memories = rows.filter(r => r.approvedFeedbackVersion === r.feedbackVersion).map(r => ({ sourceUrl: r.sameListing ? ballotSourceUrl(planDraftSchema.parse(r.original).option) : null, takeaway: r.approvedTakeaway!, date: actualOutingSchema.parse(r.actual).date!, sentiment: feedbackSentiment(r.feedback.filter(f => f.actualVersion === r.actualVersion).map(f => memoryOpinionSchema.parse(f.memoryOpinion))) }));
  return { memories, fingerprint: rows.map(r => [r.id, r.actualVersion, r.feedbackVersion, r.approvedFeedbackVersion, r.approvedTakeaway]) };
}

// Minimal completed-outing matches. Unapproved feedback/notes are never read.
// A changed actual venue without an explicit same-listing match stays unknown.
export async function groupVisitHistory(tx: Prisma.TransactionClient, groupId: string): Promise<{ history: GroupVisitHistory; fingerprint: unknown }> {
  const rows = await tx.outing.findMany({ where: { groupId, plan: { status: 'completed' } }, select: { id: true, actualVersion: true, sameListing: true, original: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 101 });
  const urls = rows.slice(0, 100).map(row => row.sameListing ? ballotSourceUrl(planDraftSchema.parse(row.original).option) : null);
  return { history: { sourceUrls: [...new Set(urls.filter((url): url is string => url !== null))], uncertain: rows.length > 100 || urls.some(url => url === null) }, fingerprint: rows.map(row => [row.id, row.actualVersion, row.sameListing, row.sameListing ? ballotSourceUrl(planDraftSchema.parse(row.original).option) : null]) };
}
