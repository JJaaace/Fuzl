import { participationContext } from '../participation/store.js';
import { localInstant, scopeWindowEnd } from '@fuzl/planning';
import type { PlanningSummary } from '@fuzl/planning';
import { createHash, timingSafeEqual } from 'node:crypto';
import { canPlanTransition, detailsFromOption, guestTokenSchema, materialPlanKey, ownRsvpSchema, planDraftSchema, planOwnerSchema, publicPlanSchema, publishedDetailsSchema, shortlistContentSchema } from '@fuzl/planning';
import type { PlanDetails, PlanDraft } from '@fuzl/planning';
import type { PlanRsvp, PlanVersion, Prisma, PrismaClient, SharedPlan } from '../generated/prisma/client.js';
import { digest } from '../guests/store.js';
import { ExtractionError } from '../extraction/errors.js';
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const unavailable = () => new ExtractionError(404, 'plan_unavailable', 'This plan or RSVP is unavailable, expired or revoked. Ask the organizer for a current link.');
const conflict = () => new ExtractionError(409, 'plan_changed', 'The plan or response changed. Reload and review the current version before retrying; your entries were kept.');
const scope = (subject: string, sessionId: string) => ({ id: sessionId, group: { owner: { authSubject: subject } } });
export class PlanStore {
  constructor(private db: PrismaClient, private now = Date.now) {}
  private async owner(tx: Prisma.TransactionClient, subject: string, sessionId: string, lock = false) {
    let session = await tx.planningSession.findFirst({ where: scope(subject, sessionId), select: { revision: true } }); if (!session) throw unavailable();
    if (lock) { await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`; session = await tx.planningSession.findFirst({ where: scope(subject, sessionId), select: { revision: true } }); }
    if (!session) throw unavailable(); return session;
  }
  private async locked(tx: Prisma.TransactionClient, subject: string, sessionId: string) {
    await this.owner(tx, subject, sessionId, true); const p = await tx.sharedPlan.findUnique({ where: { sessionId } }); if (!p) throw unavailable();
    await tx.$queryRaw`SELECT id FROM fuzl.fuzl_shared_plans WHERE id = ${p.id}::uuid FOR UPDATE`;
    return tx.sharedPlan.findUniqueOrThrow({ where: { id: p.id } });
  }
  private publicView(p: SharedPlan, v: PlanVersion) {
    const snap = planDraftSchema.parse(v.snapshot);
    return publicPlanSchema.omit({ expiresAt: true }).parse({ id: p.id, version: v.version, materialVersion: v.materialVersion, status: v.status, details: snap.details, sample: snap.option.sample, changeNotice: v.changeNotice, publishedAt: v.createdAt.toISOString(), rsvpOpen: p.status === 'confirmed' && !p.rsvpsClosed });
  }
  private ownDto(p: SharedPlan, row: PlanRsvp) { return ownRsvpSchema.parse({ alias: row.alias, choice: row.choice, revision: row.revision, answeredMaterialVersion: row.answeredMaterialVersion, needsReconfirmation: row.answeredMaterialVersion !== p.materialVersion, updatedAt: row.updatedAt.toISOString() }); }
  async get(subject: string, sessionId: string) {
    await this.owner(this.db, subject, sessionId);
    const p = await this.db.sharedPlan.findFirst({ where: { session: scope(subject, sessionId) }, include: { versions: { orderBy: { version: 'desc' }, take: 100 }, links: { orderBy: { createdAt: 'desc' }, take: 1 }, rsvps: { orderBy: { updatedAt: 'desc' }, take: 200 } } }); if (!p) return null;
    const attendance = p.rsvps.map(r => ({ id: r.id, ...this.ownDto(p, r) })), current = attendance.filter(r => !r.needsReconfirmation);
    return planOwnerSchema.parse({ id: p.id, revision: p.revision, status: p.status, draftKey: hash(planDraftSchema.parse(p.draft)), draft: p.draft, published: p.versions[0] ? this.publicView(p, p.versions[0]) : null, history: p.versions.map(v => ({ version: v.version, status: v.status, changeNotice: v.changeNotice, materialVersion: v.materialVersion, publishedAt: v.createdAt.toISOString() })), link: p.links[0] ? { expiresAt: p.links[0].expiresAt.toISOString(), revoked: !!p.links[0].revokedAt } : null, attendance, counts: { going: current.filter(r => r.choice === 'going').length, maybe: current.filter(r => r.choice === 'maybe').length, cant: current.filter(r => r.choice === 'cant').length, needsReconfirmation: attendance.length - current.length, totalResponses: attendance.length } });
  }
  async select(subject: string, sessionId: string, input: { requestId: string; revision: number; sessionRevision: number; ballotId: string; optionId: string }) {
    const fingerprint = hash(['select', input]);
    await this.db.$transaction(async tx => {
      const session = await this.owner(tx, subject, sessionId, true); let old = await tx.sharedPlan.findUnique({ where: { sessionId } });
      if (old) { await tx.$queryRaw`SELECT id FROM fuzl.fuzl_shared_plans WHERE id = ${old.id}::uuid FOR UPDATE`; old = await tx.sharedPlan.findUniqueOrThrow({ where: { id: old.id } }); }
      if (old?.lastRequestId === input.requestId) { if (old.lastRequestHash !== fingerprint) throw conflict(); return; }
      if ((old?.revision ?? 0) !== input.revision || session.revision !== input.sessionRevision) throw conflict();
      if (old && ['completed', 'cancelled'].includes(old.status)) throw new ExtractionError(409, 'plan_terminal', 'Completed or cancelled plans cannot be reopened. Start a new saved session for a new outing.');
      const ballot = await tx.ballot.findFirst({ where: { id: input.ballotId, session: scope(subject, sessionId) } }); if (!ballot) throw unavailable();
      const option = shortlistContentSchema.parse(ballot.content).options.find(o => o.id === input.optionId); if (!option) throw new ExtractionError(400, 'option_not_published', 'Choose an option from this saved session’s published ballot.');
      const draft: PlanDraft = { ballotId: ballot.id, option, details: detailsFromOption(option) };
      if (old) await tx.sharedPlan.update({ where: { id: old.id }, data: { draft: json(draft), revision: { increment: 1 }, lastRequestId: input.requestId, lastRequestHash: fingerprint } });
      else await tx.sharedPlan.create({ data: { sessionId, draft: json(draft), lastRequestId: input.requestId, lastRequestHash: fingerprint } });
    }); return this.get(subject, sessionId);
  }
  private async mutate(subject: string, sessionId: string, kind: string, input: { requestId: string; revision: number }, action: (tx: Prisma.TransactionClient, p: SharedPlan) => Promise<void>) {
    const fingerprint = hash([kind, input]);
    await this.db.$transaction(async tx => {
      const p = await this.locked(tx, subject, sessionId);
      if (p.lastRequestId === input.requestId) { if (p.lastRequestHash !== fingerprint) throw conflict(); return; }
      if (p.revision !== input.revision) throw conflict();
      await action(tx, p);
      await tx.sharedPlan.update({ where: { id: p.id }, data: { revision: { increment: 1 }, lastRequestId: input.requestId, lastRequestHash: fingerprint } });
    }); return this.get(subject, sessionId);
  }
  async save(subject: string, sessionId: string, input: { requestId: string; revision: number; details: PlanDetails }) {
    return this.mutate(subject, sessionId, 'save', input, async (tx, p) => {
      if (['completed', 'cancelled'].includes(p.status)) throw new ExtractionError(409, 'plan_terminal', 'A completed or cancelled plan cannot be edited.');
      const draft = planDraftSchema.parse(p.draft); if (JSON.stringify(input.details.attendanceScope) !== JSON.stringify(draft.details.attendanceScope)) throw new ExtractionError(400, 'scope_copy_required', 'Copy the server-reviewed attendance scope explicitly; its mode/count cannot be edited as free text.'); await tx.sharedPlan.update({ where: { id: p.id }, data: { draft: json({ ...draft, details: input.details }) } });
    });
  }
  async attachScope(subject: string, sessionId: string, input: { requestId: string; revision: number }) {
    return this.mutate(subject, sessionId, 'attendance-scope', input, async (tx, p) => {
      if (['completed', 'cancelled'].includes(p.status)) throw conflict();
      const session = await tx.planningSession.findUniqueOrThrow({ where: { id: sessionId } });
      const current = await participationContext(tx, sessionId, session.summary as unknown as PlanningSummary, session.revision, this.now());
      if (!current.scope.reviewed || !current.scope.attendeeCount) throw new ExtractionError(409, 'scope_review_required', 'Review current participant matches and opt-ins before copying the scope into the plan draft.');
      const draft = planDraftSchema.parse(p.draft), rosterKey = hash([current.scope.mode, current.scope.roster.filter(r => r.selected).map(r => r.id).sort(), current.scope.window]);
      draft.details.attendanceScope = { mode: current.scope.mode, count: current.scope.attendeeCount };
      draft.scopeProof = { scopeKey: current.scope.key, rosterKey };
      await tx.sharedPlan.update({ where: { id: p.id }, data: { draft: json(draft) } });
    });
  }
  private async version(tx: Prisma.TransactionClient, p: SharedPlan, snapshot: PlanDraft, status: string, notice: string, materialVersion: number) {
    if (p.publishedVersion >= 100) throw new ExtractionError(429, 'plan_version_limit', 'This plan has reached its 100-version limit.');
    await tx.planVersion.create({ data: { planId: p.id, version: p.publishedVersion + 1, materialVersion, snapshot: json(snapshot), status, changeNotice: notice } });
    await tx.sharedPlan.update({ where: { id: p.id }, data: { publishedVersion: { increment: 1 }, materialVersion, status } });
  }
  async publish(subject: string, sessionId: string, input: { requestId: string; revision: number; approved: true; previewKey: string; notice: string }) {
    return this.mutate(subject, sessionId, 'publish', input, async (tx, p) => {
      if (!canPlanTransition(p.status as 'proposed' | 'confirmed', 'confirmed')) throw new ExtractionError(409, 'plan_terminal', 'Only proposed or confirmed plans can be published.');
      if (p.publishedVersion >= 98) throw new ExtractionError(429, 'plan_publication_limit', 'The publication limit is reached. Closing RSVPs and cancellation/completion remain available.');
      const draft = planDraftSchema.parse(p.draft); if (hash(draft) !== input.previewKey) throw conflict(); if (!publishedDetailsSchema.safeParse(draft.details).success) throw new ExtractionError(400, 'plan_details_incomplete', 'A clear date, local time, time zone and meeting point are required. Check ambiguous daylight-saving clocks.');
      if (!draft.scopeProof && await tx.sessionScope.findUnique({ where: { sessionId }, select: { id: true } })) throw new ExtractionError(409, 'scope_copy_required', 'Copy the reviewed attendance scope into this draft, then preview and approve it before publishing.');
      if (draft.scopeProof) {
        await tx.$queryRaw`SELECT id FROM fuzl.fuzl_session_scopes WHERE "sessionId" = ${sessionId}::uuid FOR SHARE`;
        const session = await tx.planningSession.findUniqueOrThrow({ where: { id: sessionId } });
        const current = await participationContext(tx, sessionId, session.summary as unknown as PlanningSummary, session.revision, this.now());
        if (!current.scope.reviewed || current.scope.key !== draft.scopeProof.scopeKey) throw new ExtractionError(409, 'scope_changed', 'Attendance scope changed. Review it and copy it into the draft again before previewing/publishing.');
        if (current.scope.mode === 'available') {
          const w = current.scope.window, start = localInstant(draft.details.date!, draft.details.time!, draft.details.timeZone!);
          const a = w ? localInstant(w.date, w.start, w.timeZone) : null, b = w ? scopeWindowEnd(w) : null;
          if (start === null || a === null || b === null || start < a || start >= b) throw new ExtractionError(409, 'plan_outside_opt_in', 'Plan start must be inside the reviewed opt-in window. Collect and review new opt-ins for another window.');
        }
      }
      const old = p.publishedVersion ? await tx.planVersion.findUniqueOrThrow({ where: { planId_version: { planId: p.id, version: p.publishedVersion } } }) : null;
      const material = !old || materialPlanKey(planDraftSchema.parse(old.snapshot)) !== materialPlanKey(draft);
      await this.version(tx, p, draft, 'confirmed', `${old ? material ? 'Plan time, place, activity, cost or attendance scope changed. Reconfirm your RSVP. ' : 'Plan details updated. ' : 'Plan confirmed by the organizer. '}${input.notice}`,  p.materialVersion + Number(material));
    });
  }
  async control(subject: string, sessionId: string, input: { requestId: string; revision: number; action: 'completed' | 'cancelled' | 'close-rsvps'; notice: string }) {
    return this.mutate(subject, sessionId, input.action, input, async (tx, p) => {
      if (input.action === 'close-rsvps') { if (p.status !== 'confirmed') throw conflict(); if (p.rsvpsClosed) return; await tx.sharedPlan.update({ where: { id: p.id }, data: { rsvpsClosed: true } }); }
      else if (!canPlanTransition(p.status as 'proposed' | 'confirmed', input.action)) throw new ExtractionError(409, 'invalid_plan_transition', 'This plan lifecycle transition is unavailable.');
      if (p.publishedVersion) { const old = await tx.planVersion.findUniqueOrThrow({ where: { planId_version: { planId: p.id, version: p.publishedVersion } } }); await this.version(tx, p, planDraftSchema.parse(old.snapshot), input.action === 'close-rsvps' ? p.status : input.action, `${input.action === 'cancelled' ? 'CANCELLED. ' : input.action === 'completed' ? 'Plan completed. ' : 'RSVPs closed. '}${input.notice}`, p.materialVersion); }
      else await tx.sharedPlan.update({ where: { id: p.id }, data: { status: input.action === 'close-rsvps' ? p.status : input.action } });
    });
  }
  async link(subject: string, sessionId: string, input: { requestId: string; revision: number; token: string; days: number; replace: boolean }) {
    const plan = await this.mutate(subject, sessionId, 'link', input, async (tx, p) => {
      if (!p.publishedVersion) throw new ExtractionError(400, 'plan_unpublished', 'Confirm and publish the plan before creating a shared link.');
      const active = await tx.planLink.findUnique({ where: { activePlanId: p.id } });
      if (active && !active.revokedAt && active.expiresAt.getTime() > this.now() && !input.replace) throw new ExtractionError(409, 'plan_link_exists', 'An active plan link already exists. Replace it explicitly to revoke its access.');
      await tx.planLink.updateMany({ where: { activePlanId: p.id }, data: { activePlanId: null, revokedAt: new Date(this.now()) } });
      await tx.planLink.create({ data: { planId: p.id, activePlanId: p.id, tokenDigest: digest(input.token), expiresAt: new Date(this.now() + input.days * 86400000) } });
    }); return { plan, token: input.token };
  }
  async revoke(subject: string, sessionId: string, input: { requestId: string; revision: number }) {
    return this.mutate(subject, sessionId, 'revoke', input, async (tx, p) => { await tx.planLink.updateMany({ where: { activePlanId: p.id }, data: { activePlanId: null, revokedAt: new Date(this.now()) } }); });
  }
  async access(tx: Prisma.TransactionClient, token: string, lock = false) {
    if (!guestTokenSchema.safeParse(token).success) throw unavailable();
    let link = await tx.planLink.findUnique({ where: { tokenDigest: digest(token) } }); if (!link) throw unavailable();
    let plan = await tx.sharedPlan.findUniqueOrThrow({ where: { id: link.planId } });
    if (lock) { await tx.$queryRaw`SELECT id FROM fuzl.fuzl_shared_plans WHERE id = ${plan.id}::uuid FOR UPDATE`; plan = await tx.sharedPlan.findUniqueOrThrow({ where: { id: plan.id } }); link = await tx.planLink.findUniqueOrThrow({ where: { id: link.id } }); }
    if (link.revokedAt || link.activePlanId !== plan.id || link.expiresAt.getTime() <= this.now() || !plan.publishedVersion) throw unavailable(); return { plan, link };
  }
  async page(token: string) { const { plan, link } = await this.access(this.db, token); const v = await this.db.planVersion.findUniqueOrThrow({ where: { planId_version: { planId: plan.id, version: plan.publishedVersion } } }); return publicPlanSchema.parse({ ...this.publicView(plan, v), expiresAt: link.expiresAt.toISOString() }); }
  private async own(tx: Prisma.TransactionClient, planId: string, editToken: string) { if (!guestTokenSchema.safeParse(editToken).success) throw unavailable(); return tx.planRsvp.findFirst({ where: { planId, editDigest: digest(editToken) } }); }
  async readOwn(token: string, editToken: string) { const { plan } = await this.access(this.db, token), row = await this.own(this.db, plan.id, editToken); return row ? this.ownDto(plan, row) : null; }
  private open(p: SharedPlan, version: number) { if (p.status !== 'confirmed' || p.rsvpsClosed) throw new ExtractionError(409, 'rsvps_closed', 'RSVPs are closed for this plan. Cancellation/completion does not confirm attendance.'); if (p.publishedVersion !== version) throw conflict(); }
  async submit(token: string, input: { submissionId: string; editToken: string; payload: { alias: string; choice: 'going' | 'maybe' | 'cant'; planVersion: number; approved: true } }) {
    return this.db.$transaction(async tx => {
      const { plan: p, link } = await this.access(tx, token, true); this.open(p, input.payload.planVersion);
      if (same(digest(input.editToken), link.tokenDigest)) throw new ExtractionError(400, 'separate_rsvp_permission', 'RSVP editing requires its own private credential.');
      const old = await tx.planRsvp.findUnique({ where: { planId_submissionId: { planId: p.id, submissionId: input.submissionId } } });
      if (old) { if (!same(old.editDigest, digest(input.editToken))) throw unavailable(); return this.ownDto(p, old); }
      if (await this.own(tx, p.id, input.editToken)) throw unavailable(); if (await tx.planRsvp.count({ where: { planId: p.id } }) >= 200) throw new ExtractionError(429, 'rsvp_limit', 'This plan has reached its 200-response limit.');
      const row = await tx.planRsvp.create({ data: { planId: p.id, submissionId: input.submissionId, editDigest: digest(input.editToken), alias: input.payload.alias, choice: input.payload.choice, answeredMaterialVersion: p.materialVersion } }); return this.ownDto(p, row);
    });
  }
  async edit(token: string, editToken: string, input: { requestId: string; revision: number; payload: { alias: string; choice: 'going' | 'maybe' | 'cant'; planVersion: number; approved: true } }) {
    return this.db.$transaction(async tx => {
      const { plan: p } = await this.access(tx, token, true); this.open(p, input.payload.planVersion); const row = await this.own(tx, p.id, editToken); if (!row) throw unavailable();
      if (row.lastRequestId === input.requestId) { if (row.alias !== input.payload.alias || row.choice !== input.payload.choice || row.answeredMaterialVersion !== p.materialVersion) throw conflict(); return this.ownDto(p, row); }
      if (row.revision !== input.revision) throw conflict(); return this.ownDto(p, await tx.planRsvp.update({ where: { id: row.id }, data: { alias: input.payload.alias, choice: input.payload.choice, answeredMaterialVersion: p.materialVersion, revision: { increment: 1 }, lastRequestId: input.requestId } }));
    });
  }
}
