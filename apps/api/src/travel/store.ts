import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { actualOutingSchema, sessionInputSchema, travelSetupSchema, travelHistorySchema, travelDashboardSchema } from '@fuzl/planning';
import type { TravelContext, TravelSetup, ParticipationScope, travelSetupEditSchema, travelHistoryEditSchema } from '@fuzl/planning';
import type { z } from 'zod';
import { participationContext } from '../participation/store.js';
import { ExtractionError } from '../extraction/errors.js';
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const unavailable = () => new ExtractionError(404,'travel_unavailable','This saved session or completed outing is unavailable.');
const changed = () => new ExtractionError(409,'travel_changed','Travel records, roster or session changed. Entries were kept; reload and review before saving or rechecking.');
interface Envelope { revision: number; requestId: string; requestHash: string; sessionRevision: number; scopeKey: string; setup: TravelSetup }
export async function groupTravelContext(tx: Prisma.TransactionClient, groupId: string, raw: unknown, scope: ParticipationScope, sessionRevision: number, now: number) {
  const envelope = raw as Envelope | null;
  const aliases = await tx.participantAlias.findMany({ where: { groupId }, select: { id: true, name: true }, take: 200, orderBy: { id: 'asc' } });
  const rows = await tx.outing.findMany({ where: { groupId, plan: { status: 'completed' } }, select: { id: true, actual: true, actualVersion: true, revision: true, travelReview: true, plan: { select: { sessionId: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  const outings = rows.map(r => ({ id: r.id, sessionId: r.plan.sessionId, revision: r.revision, date: actualOutingSchema.parse(r.actual).date!, activity: actualOutingSchema.parse(r.actual).activity, history: r.travelReview === null ? null : travelHistorySchema.parse(r.travelReview) }));
  const parsed = travelSetupSchema.safeParse(envelope?.setup);
  const validAliases = new Set(aliases.map(a => a.id));
  const current = parsed.success && envelope?.sessionRevision === sessionRevision && envelope?.scopeKey === scope.key && parsed.data.mappings.every(m => validAliases.has(m.aliasId));
  const context: TravelContext | undefined = current ? { setup: parsed.data!, scope, now, outings: outings.filter(o => o.history !== null).map(o => ({ date: o.date, history: o.history! })) } : undefined;
  return { context, fingerprint: [raw, aliases.map(a => a.id), rows.map(r => [r.id,r.revision,r.travelReview])], dashboard: travelDashboardSchema.parse({ revision: envelope?.revision ?? 0, scope, setup: parsed.success ? parsed.data : null, current, aliases, outings }) };
}
export class TravelStore {
  constructor(private db: PrismaClient, private now = Date.now) {}
  private async owned(tx: Prisma.TransactionClient, subject: string, sessionId: string, lock = false) {
    const s = await tx.planningSession.findFirst({ where: { id: sessionId, group: { owner: { authSubject: subject } } } }); if (!s) throw unavailable();
    if (lock) await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    return tx.planningSession.findUniqueOrThrow({ where: { id: sessionId } });
  }
  async get(subject: string, sessionId: string) {
    return this.db.$transaction(async tx => { const s = await this.owned(tx,subject,sessionId), payload = sessionInputSchema.parse({ title:s.title, origin:s.origin, summaryVersion:s.summaryVersion, summary:s.summary, provenance:s.provenance }); const p = await participationContext(tx,s.id,payload.summary,s.revision,this.now()); return (await groupTravelContext(tx,s.groupId,s.travelReview,p.scope,s.revision,this.now())).dashboard; });
  }
  async save(subject: string, sessionId: string, input: z.infer<typeof travelSetupEditSchema>) {
    await this.db.$transaction(async tx => {
      const s = await this.owned(tx,subject,sessionId,true), old = s.travelReview as unknown as Envelope | null, requestHash = hash(input);
      if (old?.requestId === input.requestId) { if(old.requestHash !== requestHash) throw changed(); return; }
      const payload = sessionInputSchema.parse({ title:s.title, origin:s.origin, summaryVersion:s.summaryVersion, summary:s.summary, provenance:s.provenance }), p = await participationContext(tx,s.id,payload.summary,s.revision,this.now());
      if ((old?.revision ?? 0) !== input.revision || s.revision !== input.sessionRevision || p.scope.key !== input.scopeKey || !p.scope.reviewed) throw changed();
      const aliases = await tx.participantAlias.findMany({ where: { groupId:s.groupId }, select:{ id:true } });
      if (input.setup.mappings.some(m => !aliases.some(a => a.id===m.aliasId) || !payload.summary.participants.some(a => a.id===m.participantId)) || input.setup.estimates.some(e => e.minutes.some(m => !payload.summary.participants.some(p => p.id===m.participantId)))) throw unavailable();
      if (input.setup.estimates.some(e => Date.parse(e.checkedOn+'T00:00:00Z') > this.now())) throw new ExtractionError(400,'travel_future','A review date cannot be in the future.');
      await tx.planningSession.update({ where:{id:s.id}, data:{ travelReview:json({revision:(old?.revision??0)+1,requestId:input.requestId,requestHash,sessionRevision:s.revision,scopeKey:p.scope.key,setup:input.setup}) } });
    }); return this.get(subject,sessionId);
  }
  async history(subject: string, sessionId: string, input: z.infer<typeof travelHistoryEditSchema>) {
    await this.db.$transaction(async tx => {
      const s = await this.owned(tx,subject,sessionId,true), plan = await tx.sharedPlan.findUnique({ where:{sessionId:s.id} }); if(!plan || plan.status!=='completed') throw unavailable();
      await tx.$queryRaw`SELECT id FROM fuzl.fuzl_shared_plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
      const row = await tx.outing.findUnique({where:{planId:plan.id}});if(!row)throw unavailable();
      await tx.$queryRaw`SELECT id FROM fuzl.fuzl_outings WHERE id = ${row.id}::uuid FOR UPDATE`;
      const current = await tx.outing.findUniqueOrThrow({where:{id:row.id}}), fingerprint=hash(['travel-history',input]);
      if(current.lastRequestId===input.requestId){if(current.lastRequestHash!==fingerprint)throw changed();return;}
      if(current.revision!==input.revision)throw changed();
      const aliases=await tx.participantAlias.findMany({where:{groupId:row.groupId},select:{id:true}});
      if(input.history?.attendees.some(a=>!aliases.some(b=>b.id===a.aliasId)))throw unavailable();
      await tx.outing.update({where:{id:row.id},data:{travelReview:input.history===null?Prisma.DbNull:json(input.history),revision:{increment:1},lastRequestId:input.requestId,lastRequestHash:fingerprint}});
    });return this.get(subject,sessionId);
  }
}
