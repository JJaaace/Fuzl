import { duplicateIdea, ideaContentSchema, ideaDateState, ideaEvent, ideaOriginSchema, ideaPlace, ideaSchema, placeEvidence } from '@fuzl/planning';
import type { CardIdeaInput, IdeaContent, IdeaReference, SavedIdea } from './types.js';
import type { WorkCandidates } from '@fuzl/planning';
import type { Prisma, PrismaClient, SavedIdea as IdeaRow } from '../generated/prisma/client.js';
import { workHash } from '../adjustments/cache.js';
import { ExtractionError } from '../extraction/errors.js';
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const unavailable = () => new ExtractionError(404, 'idea_unavailable', 'This saved group or idea is unavailable for this account.');
const changed = () => new ExtractionError(409, 'idea_changed', 'The idea, group or saved session changed. Your entries were kept; refresh and review before retrying.');
export function ideaDto(row: IdeaRow, now = Date.now()): SavedIdea { const content = ideaContentSchema.parse(row.content); return ideaSchema.parse({ id: row.id, groupId: row.groupId, revision: row.revision, content, origin: row.origin, archived: row.archived, edited: row.edited, dateState: ideaDateState(content, now), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }); }
export class IdeaStore {
  constructor(private db: PrismaClient, private now = Date.now) {}
  private async group(tx: Prisma.TransactionClient, subject: string, groupId: string, lock = false) {
    if (!await tx.group.findFirst({ where: { id: groupId, owner: { authSubject: subject } }, select: { id: true } })) throw unavailable();
    if (lock) { await tx.$queryRaw`SELECT id FROM fuzl.fuzl_groups WHERE id = ${groupId}::uuid FOR UPDATE`; if (!await tx.group.findFirst({ where: { id: groupId, owner: { authSubject: subject } }, select: { id: true } })) throw unavailable(); }
  }
  async list(subject: string, groupId: string) { await this.group(this.db, subject, groupId); return (await this.db.savedIdea.findMany({ where: { groupId, group: { owner: { authSubject: subject } } }, orderBy: { updatedAt: 'desc' }, take: 100 })).map(r => ideaDto(r, this.now())); }
  async choices(subject: string, groupId: string) { return (await this.list(subject, groupId)).filter(i => !i.archived && !['past', 'date-needs-checking'].includes(i.dateState)).map(i => ({ id: i.id, revision: i.revision, name: i.content.name, kind: i.content.kind, link: i.content.link, lastCheckedOn: i.content.lastCheckedOn, origin: i.origin.provider })); }
  private async duplicate(tx: Prisma.TransactionClient, groupId: string, candidate: Pick<SavedIdea, 'content' | 'origin'>, allowed: boolean, except?: string) {
    if (allowed) return;
    const rows = await tx.savedIdea.findMany({ where: { groupId, ...(except ? { id: { not: except } } : {}) }, take: 100 });
    if (rows.some(r => duplicateIdea(candidate, ideaDto(r, this.now())))) throw new ExtractionError(409, 'idea_duplicate', 'This link or provider item is already saved in this group, possibly archived or for another date. Review existing ideas, or explicitly allow a separate repeat/date.');
  }
  private async insert(tx: Prisma.TransactionClient, groupId: string, input: { requestId: string; content: IdeaContent; allowDuplicate: boolean }, origin: SavedIdea['origin']) {
    const fingerprint = workHash(['create', input, origin]), old = await tx.savedIdea.findUnique({ where: { groupId_creationId: { groupId, creationId: input.requestId } } });
    if (old) { if (old.creationHash !== fingerprint) throw changed(); return ideaDto(old, this.now()); }
    await this.duplicate(tx, groupId, { content: input.content, origin }, input.allowDuplicate);
    if (await tx.savedIdea.count({ where: { groupId } }) >= 100) throw new ExtractionError(429, 'ideas_limit', 'This group has 100 saved ideas including archived items. Remove an old idea before adding another.');
    return ideaDto(await tx.savedIdea.create({ data: { groupId, content: json(input.content), origin: json(origin), creationId: input.requestId, creationHash: fingerprint, lastRequestId: input.requestId, lastRequestHash: fingerprint } }), this.now());
  }
  async create(subject: string, groupId: string, input: { requestId: string; content: IdeaContent; allowDuplicate: boolean }) { return this.db.$transaction(async tx => { await this.group(tx, subject, groupId, true); return this.insert(tx, groupId, input, { provider: 'manual', itemId: null, referenceUrl: input.content.link }); }); }
  async fromCard(subject: string, sessionId: string, input: CardIdeaInput, snapshot: { revision: number; context: WorkCandidates }) {
    return this.db.$transaction(async tx => {
      const scope = { id: sessionId, group: { owner: { authSubject: subject } } }, initial = await tx.planningSession.findFirst({ where: scope, select: { groupId: true } }); if (!initial) throw unavailable();
      await this.group(tx, subject, initial.groupId, true); await tx.$queryRaw`SELECT id FROM fuzl.fuzl_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
      const session = await tx.planningSession.findFirst({ where: scope, select: { groupId: true, revision: true } });
      if (!session || session.groupId !== initial.groupId || session.revision !== input.sessionRevision || snapshot.revision !== session.revision) throw changed();
      const candidate = snapshot.context.candidates.find(c => `${c.source}:${c.id}` === input.candidateKey); if (!candidate) throw unavailable();
      let origin = ideaOriginSchema.parse({ provider: candidate.source === 'organizer' ? 'manual' : candidate.source, itemId: candidate.id, referenceUrl: candidate.sourceUrl });
      if (candidate.savedIdea) { const original = await tx.savedIdea.findFirst({ where: { id: candidate.savedIdea.id, groupId: session.groupId } }); if (!original || original.revision !== candidate.savedIdea.revision) throw changed(); origin = ideaOriginSchema.parse(original.origin); }
      let content: IdeaContent;
      if ('name' in candidate) {
        const c = placeEvidence(candidate).effective;
        content = ideaContentSchema.parse({ ...input.content, kind: 'venue', eventDate: null, start: null, end: null, link: candidate.sourceUrl, address: c.address, category: c.category, lat: c.lat, lon: c.lon, timeZone: c.timeZone ?? null, lastCheckedOn: candidate.retrievedAt.slice(0, 10) });
      } else if (candidate.source === 'demo') {
        content = ideaContentSchema.parse({ ...input.content, kind: 'event', link: candidate.sourceUrl, eventDate: candidate.schedule.date, start: candidate.schedule.time, end: candidate.schedule.endTime, timeZone: candidate.schedule.timeZone, address: candidate.venue.address, lat: candidate.venue.lat, lon: candidate.venue.lon, lastCheckedOn: candidate.retrievedAt.slice(0, 10) });
      } else {
        // Ticketmaster durable bookmark: never automatically copy API title,
        // schedule, location, status, prices, images or inventory into storage.
        content = ideaContentSchema.parse({ ...input.content, kind: 'event', link: candidate.sourceUrl });
      }
      return this.insert(tx, session.groupId, { ...input, content }, origin);
    });
  }
  private async mutate(subject: string, groupId: string, ideaId: string, kind: string, input: { requestId: string; revision: number }, work: (row: IdeaRow, tx: Prisma.TransactionClient) => Promise<Prisma.SavedIdeaUpdateInput>) {
    return this.db.$transaction(async tx => {
      await this.group(tx, subject, groupId, true); const row = await tx.savedIdea.findFirst({ where: { id: ideaId, groupId } }); if (!row) throw unavailable(); const fingerprint = workHash([kind, input]);
      if (row.lastRequestId === input.requestId) { if (row.lastRequestHash !== fingerprint) throw changed(); return ideaDto(row, this.now()); }
      if (row.revision !== input.revision) throw changed();
      const data = await work(row, tx);
      return ideaDto(await tx.savedIdea.update({ where: { id: ideaId }, data: { ...data, revision: { increment: 1 }, lastRequestId: input.requestId, lastRequestHash: fingerprint } }), this.now());
    });
  }
  async update(subject: string, groupId: string, ideaId: string, input: { requestId: string; revision: number; content: IdeaContent; allowDuplicate: boolean }) {
    return this.mutate(subject, groupId, ideaId, 'update', input, async (row, tx) => {
      const old = ideaDto(row, this.now()), content = structuredClone(input.content);
      if (content.address !== old.content.address) { if (content.lat === old.content.lat && content.lon === old.content.lon) { content.lat = null; content.lon = null; } if (content.timeZone === old.content.timeZone) content.timeZone = null; }
      await this.duplicate(tx, groupId, { content, origin: old.origin }, input.allowDuplicate, ideaId);
      return { content: json(content), edited: true };
    });
  }
  async archive(subject: string, groupId: string, ideaId: string, input: { requestId: string; revision: number; archived: boolean }) { return this.mutate(subject, groupId, ideaId, 'archive', input, async () => ({ archived: input.archived })); }
  async remove(subject: string, groupId: string, ideaId: string, revision: number) {
    return this.db.$transaction(async tx => { await this.group(tx, subject, groupId, true); const row = await tx.savedIdea.findFirst({ where: { id: ideaId, groupId }, select: { revision: true } }); if (!row) return; if (row.revision !== revision) throw changed(); await tx.savedIdea.deleteMany({ where: { id: ideaId, groupId, revision } }); });
  }
  async resolve(subject: string, sessionId: string, refs: IdeaReference[], type: 'places' | 'events') {
    const session = await this.db.planningSession.findFirst({ where: { id: sessionId, group: { owner: { authSubject: subject } } }, select: { groupId: true } }); if (!session) throw unavailable();
    const rows = await this.db.savedIdea.findMany({ where: { groupId: session.groupId, id: { in: refs.map(r => r.id) } } });
    const selected = refs.map(ref => { const row = rows.find(r => r.id === ref.id); if (!row) throw unavailable(); const i = ideaDto(row, this.now()); if (i.revision !== ref.revision || i.archived || ['past', 'date-needs-checking'].includes(i.dateState)) throw new ExtractionError(409, 'idea_not_active', 'An idea changed, was archived, or has a past/unclear event date. Refresh saved ideas and review it before evaluation.'); if ((i.content.kind === 'event') !== (type === 'events')) throw new ExtractionError(400, 'idea_wrong_type', 'Evaluate dated events under Events and ongoing venues/ideas under Places.'); return i; });
    return type === 'places' ? { places: selected.map(ideaPlace), events: [] } : { places: [], events: selected.map(ideaEvent) };
  }
}
export async function ideaVersions(tx: Prisma.TransactionClient, groupId: string, now = Date.now()) {
  const rows = await tx.$queryRaw<{ id: string; revision: number; archived: boolean; kind: IdeaContent['kind']; eventDate: string | null; timeZone: string | null }[]>`SELECT id, revision, archived, content->>'kind' AS kind, content->>'eventDate' AS "eventDate", content->>'timeZone' AS "timeZone" FROM fuzl.fuzl_saved_ideas WHERE "groupId" = ${groupId}::uuid ORDER BY id LIMIT 100`;
  return rows.map(r => [r.id, r.revision, r.archived, ideaDateState(r, now)]);
}
