import { quotesUnchanged, sessionInputSchema } from '@fuzl/planning';
import type { SavedGroup, SavedSession, SessionInput, SessionListItem } from '@fuzl/planning';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { ExtractionError } from '../extraction/errors.js';
const missing = () => new ExtractionError(404, 'not_found', 'This saved item is unavailable for this account.');
const conflict = (group = false) => new ExtractionError(409, 'save_conflict', group ? 'This group changed in another tab. Your edits were kept. Refresh groups and reopen it to review the latest names before retrying.' : 'This session changed in another tab. Your edits were kept. Reopen the latest version or save a new session.');
const groupScope = (subject: string, id?: string) => ({ ...(id ? { id } : {}), owner: { authSubject: subject } });
const sessionScope = (subject: string, id?: string) => ({ ...(id ? { id } : {}), group: groupScope(subject) });
const groupInclude = { aliases: { orderBy: { createdAt: 'asc' as const } }, _count: { select: { sessions: true } } };
type GroupRow = Prisma.GroupGetPayload<{ include: typeof groupInclude }>;
const groupDTO = (row: GroupRow): SavedGroup => ({ id: row.id, name: row.name, aliases: row.aliases.map(({ id, name }) => ({ id, name })), revision: row.revision,
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), sessionCount: row._count.sessions });
type SessionRow = Prisma.PlanningSessionGetPayload<object>;
const itemDTO = (row: Pick<SessionRow, 'id' | 'groupId' | 'title' | 'revision' | 'createdAt' | 'updatedAt'>): SessionListItem => ({ id: row.id, groupId: row.groupId, title: row.title, revision: row.revision, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
function sessionDTO(row: SessionRow): SavedSession {
  const result = sessionInputSchema.safeParse({ title: row.title, summaryVersion: row.summaryVersion, summary: row.summary, provenance: row.provenance, origin: row.origin });
  if (!result.success) throw new ExtractionError(500, 'saved_format', 'The saved session has an unsupported format. Your current work was kept.');
  return { ...itemDTO(row), payload: result.data };
}
const json = (input: unknown) => JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
export class OrganizerStore {
  constructor(private db: PrismaClient) {}
  async listGroups(subject: string) { return (await this.db.group.findMany({ where: groupScope(subject), include: groupInclude, orderBy: { updatedAt: 'desc' } })).map(groupDTO); }
  async createGroup(subject: string, input: { name: string; aliases: string[] }) {
    return this.db.$transaction(async (tx) => {
      const owner = await tx.organizer.upsert({ where: { authSubject: subject }, update: {}, create: { authSubject: subject } });
      return groupDTO(await tx.group.create({ data: { ownerId: owner.id, name: input.name, aliases: { create: input.aliases.map((name) => ({ name })) } }, include: groupInclude }));
    });
  }
  async updateGroup(subject: string, id: string, input: { name: string; aliases: string[]; revision: number }) {
    return this.db.$transaction(async (tx) => {
      if (!await tx.group.findFirst({ where: groupScope(subject, id), select: { id: true } })) throw missing();
      const result = await tx.group.updateMany({ where: { ...groupScope(subject, id), revision: input.revision }, data: { name: input.name, revision: { increment: 1 } } });
      if (result.count !== 1) throw conflict(true);
      await tx.participantAlias.deleteMany({ where: { groupId: id, group: groupScope(subject) } });
      await tx.participantAlias.createMany({ data: input.aliases.map((name) => ({ groupId: id, name })) });
      return groupDTO(await tx.group.findFirstOrThrow({ where: groupScope(subject, id), include: groupInclude }));
    });
  }
  async deleteGroup(subject: string, id: string) {
    if ((await this.db.group.deleteMany({ where: groupScope(subject, id) })).count !== 1) throw missing();
  }
  async listSessions(subject: string, groupId: string) {
    if (!await this.db.group.findFirst({ where: groupScope(subject, groupId), select: { id: true } })) throw missing();
    return (await this.db.planningSession.findMany({ where: { groupId, ...sessionScope(subject) }, select: { id: true, groupId: true, title: true, revision: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } })).map(itemDTO);
  }
  async getSession(subject: string, id: string) {
    const row = await this.db.planningSession.findFirst({ where: sessionScope(subject, id) });
    if (!row) throw missing(); return sessionDTO(row);
  }
  async createSession(subject: string, groupId: string, input: SessionInput) {
    return this.db.$transaction(async (tx) => {
      if (!await tx.group.findFirst({ where: groupScope(subject, groupId), select: { id: true } })) throw missing();
      return sessionDTO(await tx.planningSession.create({ data: { groupId, title: input.title, origin: input.origin, summaryVersion: input.summaryVersion, summary: json(input.summary), provenance: json(input.provenance) } }));
    });
  }
  async updateSession(subject: string, id: string, groupId: string, revision: number, input: SessionInput) {
    return this.db.$transaction(async (tx) => {
      const previous = await tx.planningSession.findFirst({ where: sessionScope(subject, id) });
      if (!previous || !await tx.group.findFirst({ where: groupScope(subject, groupId), select: { id: true } })) throw missing();
      if (!quotesUnchanged(sessionDTO(previous).payload, input)) throw new ExtractionError(422, 'source_immutable', 'Original supporting quotations and image-reading provenance cannot be replaced. Save this replacement summary as a new session.');
      const result = await tx.planningSession.updateMany({ where: { ...sessionScope(subject, id), revision }, data: { groupId, title: input.title, origin: input.origin, summaryVersion: input.summaryVersion, summary: json(input.summary), provenance: json(input.provenance), revision: { increment: 1 } } });
      if (result.count !== 1) throw conflict();
      return sessionDTO(await tx.planningSession.findFirstOrThrow({ where: sessionScope(subject, id) }));
    });
  }
  async deleteSession(subject: string, id: string) {
    if ((await this.db.planningSession.deleteMany({ where: sessionScope(subject, id) })).count !== 1) throw missing();
  }
}
