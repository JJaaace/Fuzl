import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ballotPublishSchema, guestTokenSchema, recordId, shortlistSaveSchema, voteCreateSchema, voteEditSchema } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { ExtractionError } from '../extraction/errors.js';
import { guestErrors, publicGuestGuards, secure } from '../guests/router.js';
import { BallotStore } from './store.js';
export interface BallotOptions { store?: () => BallotStore; now?: () => number }
function input<T>(schema: { parse(v: unknown): T }, value: unknown): T { try { return schema.parse(value); } catch { throw new ExtractionError(400, 'invalid_ballot_input', 'Check the public ballot fields, option, credentials and revision. Nothing was changed.'); } }
const bearer = (req: Request) => input(guestTokenSchema, /^Bearer (.*)$/.exec(req.get('authorization') ?? '')?.[1]);
const invite = (req: Request) => input(guestTokenSchema, req.get('x-invite-token'));
function route(options: BallotOptions, work: (s: BallotStore, req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try { await work((options.store ?? (() => new BallotStore(database())))(), req, res); }
    catch (e) { if (e instanceof ExtractionError) throw e; throw new ExtractionError(503, 'ballot_storage_unavailable', 'Ballot storage is unavailable. Your entries were kept. Check migrations/connection, then retry deliberately.'); }
    finally { req.body = undefined; }
  };
}
export function publicBallotRouter(options: BallotOptions = {}) {
  const r = Router(); r.use(publicGuestGuards(options.now), (req, _res, next) => { bearer(req); if (req.path === '/vote') invite(req); next(); });
  r.get('/form', route(options, async (s, req, res) => res.json(await s.form(bearer(req)))));
  r.post('/votes', route(options, async (s, req, res) => res.json(await s.submit(bearer(req), input(voteCreateSchema, req.body)))));
  r.get('/vote', route(options, async (s, req, res) => res.json(await s.readOwn(invite(req), bearer(req)))));
  r.put('/vote', route(options, async (s, req, res) => res.json(await s.edit(invite(req), bearer(req), input(voteEditSchema, req.body)))));
  r.use(guestErrors); return r;
}
export function organizerBallotRouter(options: BallotOptions = {}) {
  const r = Router({ mergeParams: true }); r.use(secure);
  const session = (req: Request) => input(recordId, req.params.sessionId), owner = (res: Response) => res.locals.organizer as string;
  r.get('/', route(options, async (s, req, res) => res.json(await s.dashboard(owner(res), session(req)))));
  r.put('/shortlist', route(options, async (s, req, res) => res.json(await s.save(owner(res), session(req), input(shortlistSaveSchema, req.body)))));
  r.post('/publish', route(options, async (s, req, res) => res.status(201).json(await s.publish(owner(res), session(req), input(ballotPublishSchema, req.body)))));
  r.post('/:ballotId/:action', route(options, async (s, req, res) => { await s.control(owner(res), session(req), input(recordId, req.params.ballotId), input(z.strictObject({ revision: z.number().int().positive() }), req.body).revision, input(z.enum(['close', 'revoke']), req.params.action)); res.status(204).end(); }));
  r.use(guestErrors); return r;
}
