import { createIdeaSchema, updateIdeaSchema, controlIdeaSchema, cardIdeaSchema, duplicateIdea, ideaDateState, ideaSchema, ideaPlace, ideaEvent } from '@fuzl/planning';
import type { SavedIdea, IdeaReference, PlaceCandidate } from '@fuzl/planning';
import type { IdeaTransport } from './SavedIdeas';
// UI simulation only. Real ownership, SQL, locks and privacy have separate tests.
export function ideaDemo(card: PlaceCandidate) {
  const groups = [crypto.randomUUID(), crypto.randomUUID()], rows: SavedIdea[] = [], ids = new Map<string, SavedIdea>();
  const transports = groups.map(groupId => {
    const transport: IdeaTransport = async (path, method, raw) => {
      if (method === 'GET') {
        const own = rows.filter(r => r.groupId === groupId).map(r => ({ ...r, dateState: ideaDateState(r.content) }));
        return structuredClone(path === '/candidates' ? own.filter(r => !r.archived && !['past', 'date-needs-checking'].includes(r.dateState)).map(r => ({ id: r.id, revision: r.revision, name: r.content.name, kind: r.content.kind, link: r.content.link, lastCheckedOn: r.content.lastCheckedOn, origin: r.origin.provider })) : own);
      }
      if (path === '' || path === '/from-card') {
        const input = path ? cardIdeaSchema.parse(raw) : createIdeaSchema.parse(raw), old = ids.get(input.requestId); if (old) return structuredClone(old);
        let content = input.content, origin: SavedIdea['origin'] = { provider: 'manual', itemId: null, referenceUrl: content.link };
        if (path) { content = { ...content, link: card.sourceUrl, kind: 'venue', address: card.address, category: card.category, lat: card.lat, lon: card.lon, timeZone: card.timeZone ?? null, lastCheckedOn: card.retrievedAt.slice(0, 10) }; origin = { provider: 'demo', itemId: card.id, referenceUrl: card.sourceUrl }; }
        if (!input.allowDuplicate && rows.some(r => r.groupId === groupId && duplicateIdea(r, { content, origin }))) throw Error('Already saved in this group. Explicitly allow a separate repeat/date.');
        const row = ideaSchema.parse({ id: crypto.randomUUID(), groupId, revision: 1, content, origin, archived: false, edited: false, dateState: ideaDateState(content), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); rows.push(row); ids.set(input.requestId, row); return structuredClone(row);
      }
      const ideaId = path.split('/')[1], row = rows.find(r => r.groupId === groupId && r.id === ideaId); if (!row) throw Error('Idea unavailable for this group');
      const v = raw as { revision: number }; if (row.revision !== v.revision) throw Error('Idea changed. Refresh and review.');
      if (method === 'DELETE') { rows.splice(rows.indexOf(row), 1); return undefined; }
      if (path.endsWith('/archive')) { const input = controlIdeaSchema.parse(raw); row.archived = input.archived; }
      else { const input = updateIdeaSchema.parse(raw); if (!input.allowDuplicate && rows.some(r => r.groupId === groupId && r.id !== row.id && duplicateIdea(r, { content: input.content, origin: row.origin }))) throw Error('Already saved; confirm the repeat'); row.content = input.content; row.edited = true; }
      row.revision++; row.dateState = ideaDateState(row.content); row.updatedAt = new Date().toISOString(); return structuredClone(row);
    }; return transport;
  });
  const selected = (groupId: string, refs: IdeaReference[]) => refs.map(ref => { const row = rows.find(r => r.groupId === groupId && r.id === ref.id); if (!row || row.revision !== ref.revision || row.archived || ['past', 'date-needs-checking'].includes(ideaDateState(row.content))) throw Error('Saved idea is stale or inactive'); return structuredClone(row); });
  return { groups, transports, selected, places: (group: string, refs: IdeaReference[]) => selected(group, refs).map(ideaPlace), events: (group: string, refs: IdeaReference[]) => selected(group, refs).map(ideaEvent) };
}
