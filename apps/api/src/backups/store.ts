import { createHash, randomUUID } from 'node:crypto';
import { assessBackup, backupDashboardSchema, backupPreviewSchema, backupRecordSchema, backupPublicDetails, ballotOptionSchema, planDraftSchema, sessionInputSchema, shortlistContentSchema } from '@fuzl/planning';
import type { PlanBackup, PlanDraft, backupSaveSchema, backupPreviewInputSchema, backupSwitchSchema } from '@fuzl/planning';
import type { z } from 'zod';
import type { Prisma, PrismaClient, SharedPlan } from '../generated/prisma/client.js';
import { PlanStore } from '../plans/store.js';
import { loadPlaceContext } from '../places/store.js';
import { ExtractionError } from '../extraction/errors.js';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const changed = () => new ExtractionError(409, 'backup_changed', 'The plan, backup, saved constraints, private answers or attendance scope changed. Keep your entries, refresh plan & attendance, reload the backup and preview again before switching.');
const unavailable = () => new ExtractionError(404, 'backup_unavailable', 'A confirmed owned plan is required to prepare or switch a backup.');
export class BackupStore {
  constructor(private db: PrismaClient, private now = Date.now) {}
  private async owned(tx: Prisma.TransactionClient, subject: string, sessionId: string, lock = false) {
    const where = { id: sessionId, group: { owner: { authSubject: subject } } };
    if (!await tx.planningSession.findFirst({ where })) throw unavailable();
    if (lock) await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const session = await tx.planningSession.findFirst({ where }); if (!session) throw unavailable();
    const row = await tx.sharedPlan.findUnique({ where: { sessionId } }); if (!row) throw unavailable();
    if (lock) await tx.$queryRaw`SELECT id FROM fuzl.fuzl_shared_plans WHERE id = ${row.id}::uuid FOR UPDATE`;
    const plan = await tx.sharedPlan.findUniqueOrThrow({ where: { id: row.id } });
    return { session, plan };
  }
  private async checked(tx: Prisma.TransactionClient, subject: string, sessionId: string, p: SharedPlan) {
    if (p.status !== 'confirmed' || !p.publishedVersion || !p.backup) throw unavailable();
    const backup = backupRecordSchema.parse(p.backup), session = await tx.planningSession.findUniqueOrThrow({ where: { id: sessionId } });
    const payload = sessionInputSchema.parse({ title: session.title, summaryVersion: session.summaryVersion, origin: session.origin, summary: session.summary, provenance: session.provenance });
    const context = await loadPlaceContext(tx, subject, sessionId, { summary: payload.summary, sessionRevision: session.revision, query: { date: backup.details.date, start: backup.details.time, end: backup.endTime, timeZone: backup.details.timeZone } }, this.now());
    const scope = context.participation!;
    const assessment = assessBackup(backup, context.checkingSummary!, scope, context.privateSpending, this.now(), context.travel);
    return { backup, session, context, assessment };
  }
  async get(subject: string, sessionId: string) {
    return this.db.$transaction(async tx => { const { plan } = await this.owned(tx, subject, sessionId); if (!plan.backup) return { backup: null, assessment: null }; if (plan.status !== 'confirmed') return backupDashboardSchema.parse({ backup: plan.backup, assessment: null }); try { const c = await this.checked(tx, subject, sessionId, plan); return backupDashboardSchema.parse({ backup: c.backup, assessment: c.assessment }); } catch (e) { if (e instanceof ExtractionError && e.code === 'scope_review_required') return backupDashboardSchema.parse({ backup: plan.backup, assessment: null, message: e.message }); throw e; } });
  }
  async save(subject: string, sessionId: string, input: z.infer<typeof backupSaveSchema>) {
    await this.db.$transaction(async tx => {
      const { session, plan } = await this.owned(tx, subject, sessionId, true), requestHash = hash(['backup-save', input]);
      if (plan.lastRequestId === input.requestId) { if (plan.lastRequestHash !== requestHash) throw changed(); return; }
      if (plan.status !== 'confirmed' || !plan.publishedVersion) throw unavailable();
      const old = plan.backup ? backupRecordSchema.parse(plan.backup) : null;
      if (session.revision !== input.sessionRevision || plan.revision !== input.revision || (old?.revision ?? 0) !== input.backupRevision) throw changed();
      const id = old?.id ?? randomUUID(); let option;
      if (input.source.kind === 'shortlist') {
        const shortlist = await tx.ballotShortlist.findUnique({ where: { sessionId } });
        if (!shortlist || shortlist.revision !== input.source.shortlistRevision) throw changed();
        const optionId = input.source.optionId;
        option = shortlistContentSchema.parse(shortlist.content).options.find(o => o.id === optionId);
        if (!option) throw new ExtractionError(400, 'backup_not_shortlisted', 'Choose an option from this saved session’s saved shortlist, or enter a manual backup.');
      } else option = ballotOptionSchema.parse({ id, kind: 'idea', name: input.details.activity, time: null, location: input.details.meetingPoint, cost: input.details.cost, links: input.details.links, unresolved: [], sample: planDraftSchema.parse(plan.draft).option.sample });
      // Scope is server-owned. Public attendance metadata is copied only at preview.
      if (input.details.attendanceScope) throw new ExtractionError(400, 'backup_scope_server_owned', 'Review attendance through the session scope; do not enter its count as backup text.');
      const backup: PlanBackup = { id, revision: (old?.revision ?? 0) + 1, usedAtVersion: null, origin: input.source.kind, shortlistRevision: input.source.kind === 'shortlist' ? input.source.shortlistRevision : null, option, details: input.details, endTime: input.endTime, availabilityTimeZone: input.availabilityTimeZone, privateNote: input.privateNote };
      await tx.sharedPlan.update({ where: { id: plan.id }, data: { backup: json(backup), revision: { increment: 1 }, lastRequestId: input.requestId, lastRequestHash: requestHash } });
    });
    // A backup can be saved with unresolved/conflicting scope; a fresh preview
    // and review are still required to publish. Do not turn a post-save read
    // failure into an ambiguous write failure.
    return new PlanStore(this.db, this.now).get(subject, sessionId);
  }
  private async makePreview(tx: Prisma.TransactionClient, subject: string, sessionId: string, p: SharedPlan, input: z.infer<typeof backupPreviewInputSchema>) {
    const c = await this.checked(tx, subject, sessionId, p);
    if (p.revision !== input.revision || c.session.revision !== input.sessionRevision || c.backup.revision !== input.backupRevision || c.backup.usedAtVersion !== null) throw changed();
    const current = await tx.planVersion.findUniqueOrThrow({ where: { planId_version: { planId: p.id, version: p.publishedVersion } } });
    const original = planDraftSchema.parse(current.snapshot), scope = c.assessment.scope;
    if (!scope.reviewed || !scope.attendeeCount) throw new ExtractionError(409, 'scope_review_required', 'Review a nonempty current attendance scope before previewing a backup switch.');
    const replacement: PlanDraft = { ballotId: original.ballotId, option: c.backup.option, details: backupPublicDetails(c.backup, c.assessment), replacement: { kind: 'backup', backupId: c.backup.id, backupRevision: c.backup.revision, fromVersion: p.publishedVersion, origin: c.backup.origin }, scopeProof: { scopeKey: scope.key, rosterKey: hash([scope.mode, scope.roster.filter(r => r.selected).map(r => r.id).sort(), scope.window]) } };
    const notice = `Switched to the prepared backup. ${input.notice}`;
    // checkedAt is presentation only. Evidence/status, expiry/scope and private
    // context are bound without serializing raw private answers in the proof.
    const previewKey = hash([p.id, p.revision, c.backup, c.context.version, c.session.revision, replacement, c.assessment.checks, notice]);
    const published = { id: p.id, version: current.version, materialVersion: current.materialVersion, status: current.status, details: original.details, sample: original.option.sample, changeNotice: current.changeNotice, publishedAt: current.createdAt.toISOString(), rsvpOpen: !p.rsvpsClosed };
    return backupPreviewSchema.parse({ previewKey, revision: p.revision, backupRevision: c.backup.revision, sessionRevision: c.session.revision, current: published, replacement, assessment: c.assessment, notice });
  }
  async preview(subject: string, sessionId: string, input: z.infer<typeof backupPreviewInputSchema>) {
    return this.db.$transaction(async tx => { const { plan } = await this.owned(tx, subject, sessionId); return this.makePreview(tx, subject, sessionId, plan, input); });
  }
  async switch(subject: string, sessionId: string, input: z.infer<typeof backupSwitchSchema>) {
    await this.db.$transaction(async tx => {
      const { plan } = await this.owned(tx, subject, sessionId, true), requestHash = hash(['backup-switch', input]);
      if (plan.lastRequestId === input.requestId) { if (plan.lastRequestHash !== requestHash) throw changed(); return; }
      // Scope edits lock this row; budget submissions/edits lock their invite.
      // Pin both while rechecking and publishing so neither can race the switch.
      await tx.$queryRaw`SELECT id FROM fuzl.fuzl_session_scopes WHERE "sessionId" = ${sessionId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM fuzl.fuzl_guest_invites WHERE "sessionId" = ${sessionId}::uuid ORDER BY id FOR SHARE`;
      const preview = await this.makePreview(tx, subject, sessionId, plan, input);
      if (preview.previewKey !== input.previewKey) throw changed();
      if (preview.assessment.status === 'does-not-fit') throw new ExtractionError(409, 'backup_conflicts', 'A known firm conflict prevents this switch. Resolve the backup or saved constraints, then preview again. Approval cannot waive a firm limit.');
      const plans = new PlanStore(this.db, this.now);
      await plans.publishSnapshot(tx, plan, preview.replacement, preview.notice);
      const backup = backupRecordSchema.parse(plan.backup);
      await tx.sharedPlan.update({ where: { id: plan.id }, data: { draft: json(preview.replacement), backup: json({ ...backup, usedAtVersion: plan.publishedVersion + 1 }), revision: { increment: 1 }, lastRequestId: input.requestId, lastRequestHash: requestHash } });
    });
    return new PlanStore(this.db, this.now).get(subject, sessionId);
  }
}
