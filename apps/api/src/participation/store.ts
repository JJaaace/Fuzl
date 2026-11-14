import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { availabilityFor, scopeDashboardSchema, scopeWindowSchema, scopeWindowEnd, localInstant, windowWithin, scopeOwnReplySchema, optInChoiceSchema, reviewScopeSchema } from '@fuzl/planning';
import type { PlanningSummary, ScopeWindow, ParticipationScope, createScopeWindowSchema, resetScopeSchema, scopeReplySchema } from '@fuzl/planning';
import type { PrismaClient, Prisma, SessionScope } from '../generated/prisma/client.js';
import { workHash } from '../adjustments/cache.js';
import { digest } from '../guests/store.js';
import { ExtractionError } from '../extraction/errors.js';
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const changed = () => new ExtractionError(409, 'scope_changed', 'The roster, replies, window or saved session changed. Keep your entries, refresh participation and review the scope again.');
const denied = () => new ExtractionError(404, 'scope_unavailable', 'This session window or guest response is unavailable, expired or revoked.');
const maps = reviewScopeSchema.shape.mappings, ids = reviewScopeSchema.shape.selected;
export async function participationContext(tx: Prisma.TransactionClient, sessionId: string, summary: PlanningSummary, sessionRevision: number, now = Date.now(), hint?: ScopeWindow) {
  const row = await tx.sessionScope.findUnique({ where: { sessionId }, include: { invite: true } });
  const replies = await tx.guestResponse.findMany({ where: { invite: { sessionId } }, select: { id: true, alias: true, revision: true, inviteId: true }, orderBy: { id: 'asc' }, take: 200 });
  const optIns = row?.inviteId ? await tx.scopeOptIn.findMany({ where: { scopeId: row.id, inviteId: row.inviteId }, orderBy: { id: 'asc' }, take: 200 }) : [];
  const mappings = row ? maps.parse(row.mappings) : [], selected = row ? ids.parse(row.selected) : [];
  const configured = row?.window ? scopeWindowSchema.parse(row.window) : null;
  const active = !!row?.invite && row.invite.activeSessionId === sessionId && !row.invite.revokedAt && row.invite.expiresAt.getTime() > now;
  const mode = row?.mode === 'available' ? 'available' as const : 'everyone' as const;
  const groupWindows = summary.facts.filter(f => f.kind === 'schedule' && f.subject.kind === 'group' && f.status === 'confirmed' && (!f.extraction || f.extraction.reviewed));
  const groupWindow = groupWindows.length === 1 && groupWindows[0].kind === 'schedule' ? scopeWindowSchema.safeParse({ date: groupWindows[0].exactDate, start: groupWindows[0].startTime, end: groupWindows[0].endTime, timeZone: hint?.timeZone ?? configured?.timeZone }) : null;
  const window = mode === 'available' ? configured : hint ?? configured ?? (groupWindow?.success ? groupWindow.data : null);
  const key = workHash([sessionRevision, summary.participants, row ? [row.id, row.revision, row.mode, configured, mappings, selected] : null, active, replies.map(r => [r.id, r.revision]), optIns.map(r => [r.id, r.revision])]);
  const reviewed = mode === 'everyone' || !!row && active && row.reviewHash === key;
  const roster = summary.participants.map(p => {
    const mapped = mappings.filter(m => m.participantId === p.id).map(m => replies.find(r => r.id === m.responseId && r.inviteId === row?.inviteId)).filter(r => r !== undefined);
    const choice = active && configured && window && windowWithin(window, configured) === true && mapped.length === 1 ? optIns.find(o => o.responseId === mapped[0].id)?.choice : undefined;
    return { evidence: choice ? 'opt-in' as const : summary.facts.some(f => f.kind === 'schedule' && (f.subject.kind === 'participant' && f.subject.participantId === p.id || f.subject.kind === 'group')) ? 'planning-fact' as const : 'unknown' as const, id: p.id, name: p.name, availability: availabilityFor(summary, p.id, window, choice ? optInChoiceSchema.parse(choice) : undefined), selected: mode === 'everyone' || selected.includes(p.id) };
  });
  const scope: ParticipationScope = { mode, attendeeCount: roster.filter(r => r.selected).length, roster, window, expiresAt: row?.invite?.expiresAt.toISOString() ?? null, reviewed, key };
  return { row, scope, mappings, selected, active, replies: replies.map(r => ({ responseId: r.id, alias: r.alias, revision: r.revision, currentWindow: active && r.inviteId === row?.inviteId, choice: optIns.find(o => o.responseId === r.id)?.choice ? optInChoiceSchema.parse(optIns.find(o => o.responseId === r.id)!.choice) : null, optInRevision: optIns.find(o => o.responseId === r.id)?.revision ?? 0 })) };
}
export class ParticipationStore {
  constructor(private db: PrismaClient, private now = Date.now) {}
  private async owner(tx: Prisma.TransactionClient, subject: string, sessionId: string, lock = false) {
    const where = { id: sessionId, group: { owner: { authSubject: subject } } };
    if (!await tx.planningSession.findFirst({ where, select: { id: true } })) throw denied();
    if (lock) await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const session = await tx.planningSession.findFirst({ where }); if (!session) throw denied();
    return session;
  }
  private async dashboard(tx: Prisma.TransactionClient, subject: string, sessionId: string) {
    const session = await this.owner(tx, subject, sessionId);
    const summary = session.summary as unknown as PlanningSummary;
    const data = await participationContext(tx, sessionId, summary, session.revision, this.now());
    return scopeDashboardSchema.parse({ scope: data.scope, revision: data.row?.revision ?? 0, sessionRevision: session.revision, mappings: data.mappings, selected: data.selected, replies: data.replies, active: data.active });
  }
  async get(subject: string, sessionId: string) { return this.dashboard(this.db, subject, sessionId); }
  private async mutate(subject: string, sessionId: string, input: z.infer<typeof resetScopeSchema>, kind: string, work: (tx: Prisma.TransactionClient, row: SessionScope, summary: PlanningSummary, beforeKey: string) => Promise<void>) {
    return this.db.$transaction(async tx => {
      const session = await this.owner(tx, subject, sessionId, true);
      const old = await tx.sessionScope.findUnique({ where: { sessionId } }), fingerprint = workHash([kind, input]);
      if (old?.lastRequestId === input.requestId) { if (old.lastRequestHash !== fingerprint) throw changed(); return this.dashboard(tx, subject, sessionId); }
      if ((old?.revision ?? 0) !== input.revision || session.revision !== input.sessionRevision) throw changed();
      if (old) await tx.$queryRaw`SELECT id FROM fuzl.fuzl_session_scopes WHERE id = ${old.id}::uuid FOR UPDATE`;
      const beforeKey = (await participationContext(tx, sessionId, session.summary as unknown as PlanningSummary, session.revision, this.now())).scope.key;
      const row = old ?? await tx.sessionScope.create({ data: { sessionId, lastRequestId: input.requestId, lastRequestHash: fingerprint } });
      await work(tx, row, session.summary as unknown as PlanningSummary, beforeKey);
      await tx.sessionScope.update({ where: { id: row.id }, data: { revision: old ? { increment: 1 } : 1, lastRequestId: input.requestId, lastRequestHash: fingerprint } });
      // Approval pins the post-update revision, not an earlier displayed response.
      if (kind === 'review') { const current = await this.dashboard(tx, subject, sessionId); await tx.sessionScope.update({ where: { id: row.id }, data: { reviewHash: current.scope.key } }); }
      return this.dashboard(tx, subject, sessionId);
    });
  }
  async window(subject: string, sessionId: string, input: z.infer<typeof createScopeWindowSchema>) {
    const end = scopeWindowEnd(input.window), start = localInstant(input.window.date, input.window.start, input.window.timeZone);
    if (end === null || start === null || end <= this.now() || end > this.now() + 14 * 86400000) throw new ExtractionError(400, 'invalid_scope_window', 'Choose an unambiguous date or same-day local window ending in the next 14 days. No opt-in can be extended beyond its end.');
    const dashboard = await this.mutate(subject, sessionId, input, 'window', async (tx, row) => {
      const active = await tx.guestInvite.findFirst({ where: { activeSessionId: sessionId, revokedAt: null, expiresAt: { gt: new Date(this.now()) } } });
      if (active && !input.replace) throw new ExtractionError(409, 'scope_invite_exists', 'An active question link exists. Explicitly replace it to create this window and revoke old editing access.');
      await tx.guestInvite.updateMany({ where: { activeSessionId: sessionId }, data: { activeSessionId: null, revokedAt: new Date(this.now()) } });
      const invite = await tx.guestInvite.create({ data: { sessionId, activeSessionId: sessionId, tokenDigest: digest(input.inviteToken), title: 'Are you available for this outing?', questions: json([{ id: randomUUID(), type: 'budget', text: 'Optional limit for this outing (private by default)', required: false }]), expiresAt: new Date(end) } });
      await tx.sessionScope.update({ where: { id: row.id }, data: { window: json(input.window), inviteId: invite.id, mode: 'everyone', selected: [], reviewHash: null } });
    });
    return { dashboard, token: input.inviteToken };
  }
  async review(subject: string, sessionId: string, input: z.infer<typeof reviewScopeSchema>) {
    return this.mutate(subject, sessionId, input, 'review', async (tx, row, summary, beforeKey) => {
      const before = await participationContext(tx, sessionId, summary, input.sessionRevision, this.now());
      if (beforeKey !== input.expectedKey || input.revision > 0 && before.scope.key !== input.expectedKey) throw changed();
      if (input.mappings.some(m => !summary.participants.some(p => p.id === m.participantId) || !before.replies.some(r => r.responseId === m.responseId))) throw denied();
      const current = input.mappings.filter(m => before.replies.some(r => r.responseId === m.responseId && r.currentWindow));
      if (new Set(current.map(m => m.participantId)).size !== current.length) throw new ExtractionError(400, 'scope_duplicate_identity', 'Match only one current-window response credential to each participant. Names alone do not establish identity.');
      if (input.mode === 'available' && (!before.active || !before.scope.window || !input.selected.length || input.selected.some(id => !summary.participants.some(p => p.id === id) || !current.some(m => m.participantId === id && before.replies.some(r => r.responseId === m.responseId && r.choice === 'yes'))))) throw new ExtractionError(409, 'scope_not_opted_in', 'Select only explicitly matched Yes opt-ins for the active window. Tentative, unavailable and missing replies cannot join this subset.');
      await tx.sessionScope.update({ where: { id: row.id }, data: { mode: input.mode, mappings: json(input.mappings), selected: json(input.mode === 'available' ? input.selected : summary.participants.map(p => p.id)), reviewHash: null } });
    });
  }
  async revoke(subject: string, sessionId: string, input: z.infer<typeof resetScopeSchema>) {
    return this.mutate(subject, sessionId, input, 'revoke', async (tx, row) => { if (row.inviteId) await tx.guestInvite.update({ where: { id: row.inviteId }, data: { revokedAt: new Date(this.now()), activeSessionId: null } }); await tx.sessionScope.update({ where: { id: row.id }, data: { mode: 'everyone', selected: [], reviewHash: null } }); });
  }
  private async guest(tx: Prisma.TransactionClient, inviteToken: string, editToken: string) {
    const invite = await tx.guestInvite.findUnique({ where: { tokenDigest: digest(inviteToken) } }); if (!invite) throw denied();
    const scope = await tx.sessionScope.findFirst({ where: { inviteId: invite.id, sessionId: invite.sessionId } }); if (!scope) throw denied();
    await tx.$queryRaw`SELECT id FROM fuzl.fuzl_session_scopes WHERE id = ${scope.id}::uuid FOR UPDATE`;
    const current = await tx.sessionScope.findUniqueOrThrow({ where: { id: scope.id } }), fresh = await tx.guestInvite.findUniqueOrThrow({ where: { id: invite.id } });
    if (current.inviteId !== fresh.id || fresh.activeSessionId !== fresh.sessionId || fresh.revokedAt || fresh.expiresAt.getTime() <= this.now()) throw denied();
    const response = await tx.guestResponse.findFirst({ where: { inviteId: fresh.id, editDigest: digest(editToken) } }); if (!response || digest(editToken) === fresh.tokenDigest) throw denied();
    return { scope: current, invite: fresh, response };
  }
  async own(invite: string, edit: string) { return this.db.$transaction(async tx => { const a = await this.guest(tx, invite, edit); const row = await tx.scopeOptIn.findUnique({ where: { scopeId_inviteId_responseId: { scopeId: a.scope.id, inviteId: a.invite.id, responseId: a.response.id } } }); return scopeOwnReplySchema.parse(row ? { choice: row.choice, revision: row.revision, updatedAt: row.updatedAt.toISOString() } : { choice: 'unknown', revision: 0, updatedAt: null }); }); }
  async reply(invite: string, edit: string, input: z.infer<typeof scopeReplySchema>) {
    return this.db.$transaction(async tx => {
      const a = await this.guest(tx, invite, edit), where = { scopeId: a.scope.id, inviteId: a.invite.id, responseId: a.response.id }, old = await tx.scopeOptIn.findUnique({ where: { scopeId_inviteId_responseId: where } }), fingerprint = workHash(input);
      if (old?.lastRequestId === input.requestId) { if (old.lastRequestHash !== fingerprint) throw changed(); return scopeOwnReplySchema.parse({ choice: old.choice, revision: old.revision, updatedAt: old.updatedAt.toISOString() }); }
      if ((old?.revision ?? 0) !== input.revision) throw changed();
      const data = { choice: input.choice, lastRequestId: input.requestId, lastRequestHash: fingerprint };
      const row = old ? await tx.scopeOptIn.update({ where: { id: old.id }, data: { ...data, revision: { increment: 1 } } }) : await tx.scopeOptIn.create({ data: { ...where, ...data } });
      await tx.sessionScope.update({ where: { id: a.scope.id }, data: { reviewHash: null } });
      return scopeOwnReplySchema.parse({ choice: row.choice, revision: row.revision, updatedAt: row.updatedAt.toISOString() });
    });
  }
}
