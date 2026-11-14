import { Router } from 'express';
import type { Request, Response } from 'express';
import { recordId, createIdeaSchema, updateIdeaSchema, controlIdeaSchema, deleteIdeaSchema, cardIdeaSchema } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { secure, guestErrors } from '../guests/router.js';
import { ExtractionError } from '../extraction/errors.js';
import { IdeaStore } from './store.js';
import type { AdjustmentCache } from '../adjustments/cache.js';
export interface IdeaOptions { store?: () => IdeaStore; cache?: AdjustmentCache; now?: () => number }
const parse = <T>(schema: { parse(v: unknown): T }, value: unknown): T => { try { return schema.parse(value); } catch { throw new ExtractionError(400, 'invalid_idea', 'Check the idea name, safe optional link, date/time, coordinates and revision. Your entries were kept.'); } };
const route = (o: IdeaOptions, work: (s: IdeaStore, r: Request, res: Response) => Promise<unknown>) => async (r: Request, res: Response) => { try { await work((o.store ?? (() => new IdeaStore(database(), o.now)))(), r, res); } catch (e) { if (e instanceof ExtractionError) throw e; throw new ExtractionError(503, 'ideas_unavailable', 'Saved ideas are unavailable. Your entries were kept; check migrations/connection and retry deliberately.'); } finally { r.body = undefined; } };
export function groupIdeaRouter(options: IdeaOptions = {}) {
  const r = Router({ mergeParams: true }); r.use(secure); const group = (r: Request) => parse(recordId, r.params.id), idea = (r: Request) => parse(recordId, r.params.ideaId), owner = (res: Response) => res.locals.organizer as string;
  r.get('/', route(options, async (s, r, res) => res.json(await s.list(owner(res), group(r)))));
  r.get('/candidates', route(options, async (s, r, res) => res.json(await s.choices(owner(res), group(r)))));
  r.post('/', route(options, async (s, r, res) => res.json(await s.create(owner(res), group(r), parse(createIdeaSchema, r.body)))));
  r.put('/:ideaId', route(options, async (s, r, res) => res.json(await s.update(owner(res), group(r), idea(r), parse(updateIdeaSchema, r.body)))));
  r.post('/:ideaId/archive', route(options, async (s, r, res) => res.json(await s.archive(owner(res), group(r), idea(r), parse(controlIdeaSchema, r.body)))));
  r.delete('/:ideaId', route(options, async (s, r, res) => { const v = parse(deleteIdeaSchema, r.body); await s.remove(owner(res), group(r), idea(r), v.revision); res.status(204).end(); }));
  r.use(guestErrors); return r;
}
export function sessionIdeaRouter(options: IdeaOptions = {}) {
  const r = Router({ mergeParams: true }); r.use(secure);
  r.post('/from-card', route(options, async (s, r, res) => {
    const input = parse(cardIdeaSchema, r.body), sessionId = parse(recordId, r.params.sessionId), subject = res.locals.organizer as string;
    const snapshot = options.cache?.get(input.snapshotId, subject, sessionId); if (!snapshot) throw new ExtractionError(410, 'idea_card_expired', 'The source card expired. Search again before saving this reference.');
    res.json(await s.fromCard(subject, sessionId, input, snapshot));
  }));
  r.use(guestErrors); return r;
}
