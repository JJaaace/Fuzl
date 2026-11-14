import { Router } from 'express';
import { createScopeWindowSchema, reviewScopeSchema, resetScopeSchema, scopeReplySchema, guestTokenSchema, recordId } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { secure, guestErrors } from '../guests/router.js';
import { ParticipationStore } from './store.js';
import { ExtractionError } from '../extraction/errors.js';
export interface ParticipationOptions { store?: () => ParticipationStore; now?: () => number }
const parse = <T>(s: { parse(v: unknown): T }, v: unknown): T => { try { return s.parse(v); } catch { throw new ExtractionError(400, 'invalid_participation', 'Check the roster, exact window, response mapping and current revision. Nothing was changed.'); } };
function route(o: ParticipationOptions, work: (s: ParticipationStore, req: import('express').Request, res: import('express').Response) => Promise<unknown>) { return async (req: import('express').Request, res: import('express').Response) => { try { await work((o.store ?? (() => new ParticipationStore(database(), o.now)))(), req, res); } catch (e) { if (e instanceof ExtractionError) throw e; throw new ExtractionError(503, 'participation_unavailable', 'Participation could not load or save. Entries were kept; check migrations/connection and retry deliberately.'); } finally { req.body = undefined; } }; }
export function organizerParticipationRouter(o: ParticipationOptions = {}) {
  const r = Router({ mergeParams: true }); r.use(secure);
  const session = (q: import('express').Request) => parse(recordId, q.params.sessionId), owner = (s: import('express').Response) => s.locals.organizer as string;
  r.get('/', route(o, async (s, q, p) => p.json(await s.get(owner(p), session(q)))));
  r.post('/window', route(o, async (s, q, p) => p.json(await s.window(owner(p), session(q), parse(createScopeWindowSchema, q.body)))));
  r.post('/review', route(o, async (s, q, p) => p.json(await s.review(owner(p), session(q), parse(reviewScopeSchema, q.body)))));
  r.post('/revoke', route(o, async (s, q, p) => p.json(await s.revoke(owner(p), session(q), parse(resetScopeSchema, q.body)))));
  r.use(guestErrors); return r;
}
// Mounted inside the existing public guest guards (origin, JSON size and rate).
export function guestParticipationRouter(o: ParticipationOptions = {}) {
  const r = Router(); r.use(secure); const edit = (q: import('express').Request) => parse(guestTokenSchema, /^Bearer (.*)$/.exec(q.get('authorization') ?? '')?.[1]), invite = (q: import('express').Request) => parse(guestTokenSchema, q.get('x-invite-token'));
  r.get('/participation', route(o, async (s, q, p) => p.json(await s.own(invite(q), edit(q)))));
  r.put('/participation', route(o, async (s, q, p) => p.json(await s.reply(invite(q), edit(q), parse(scopeReplySchema, q.body)))));
  r.use(guestErrors); return r;
}
