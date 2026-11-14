import { Router } from 'express';
import type { Request, Response } from 'express';
import { recordId, guestTokenSchema, recordOutingSchema, outingEditSchema, memoryEditSchema, feedbackCreateSchema, feedbackEditSchema } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { publicGuestGuards, secure, guestErrors } from '../guests/router.js';
import { ExtractionError } from '../extraction/errors.js';
import { OutingStore } from './store.js';
export interface OutingOptions { store?: () => OutingStore; now?: () => number }
function parse<T>(schema: { parse(v: unknown): T }, v: unknown): T { try { return schema.parse(v); } catch { throw new ExtractionError(400, 'invalid_outing_input', 'Check actual outing details, attendance, optional answers, permission and revision. Nothing changed.'); } }
const bearer = (r: Request) => parse(guestTokenSchema, /^Bearer (.*)$/.exec(r.get('authorization') ?? '')?.[1]);
const invite = (r: Request) => parse(guestTokenSchema, r.get('x-invite-token'));
const route = (o: OutingOptions, work: (s: OutingStore, r: Request, res: Response) => Promise<unknown>) => async (r: Request, res: Response) => { try { await work((o.store ?? (() => new OutingStore(database())))(), r, res); } catch (e) { if (e instanceof ExtractionError) throw e; throw new ExtractionError(503, 'outing_storage_unavailable', 'Outing storage is unavailable. Entries were kept; check migrations and retry deliberately.'); } finally { r.body = undefined; } };
export function organizerOutingRouter(options: OutingOptions = {}) {
  const r = Router({ mergeParams: true }); r.use(secure);
  const session = (r: Request) => parse(recordId, r.params.sessionId), owner = (res: Response) => res.locals.organizer as string;
  r.get('/', route(options, async (s, r, res) => res.json(await s.get(owner(res), session(r)))));
  r.post('/complete', route(options, async (s, r, res) => res.json(await s.complete(owner(res), session(r), parse(recordOutingSchema, r.body)))));
  r.put('/actual', route(options, async (s, r, res) => res.json(await s.editActual(owner(res), session(r), parse(outingEditSchema, r.body)))));
  r.put('/memory', route(options, async (s, r, res) => res.json(await s.memory(owner(res), session(r), parse(memoryEditSchema, r.body)))));
  r.use(guestErrors); return r;
}
export function pastOutingRouter(options: OutingOptions = {}) {
  const r = Router({ mergeParams: true }); r.use(secure);
  r.get('/', route(options, async (s, r, res) => res.json(await s.past(res.locals.organizer as string, parse(recordId, r.params.id)))));
  r.use(guestErrors); return r;
}
export function publicOutingRouter(options: OutingOptions = {}) {
  const r = Router(); r.use(publicGuestGuards(options.now), (r, _res, next) => { bearer(r); if (r.path === '/feedback') invite(r); next(); });
  r.get('/outing', route(options, async (s, r, res) => res.json(await s.page(bearer(r)))));
  r.get('/feedback', route(options, async (s, r, res) => res.json(await s.readOwn(invite(r), bearer(r)))));
  r.post('/feedbacks', route(options, async (s, r, res) => { const p = parse(feedbackCreateSchema, r.body); res.json(await s.feedback(bearer(r), p.editToken, p)); }));
  r.put('/feedback', route(options, async (s, r, res) => res.json(await s.feedback(invite(r), bearer(r), parse(feedbackEditSchema, r.body)))));
  r.use(guestErrors); return r;
}
