import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { controlPlanSchema, guestTokenSchema, planLinkInputSchema, planMutationBase, publishPlanSchema, recordId, rsvpCreateSchema, rsvpEditSchema, savePlanSchema, selectPlanSchema } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { ExtractionError } from '../extraction/errors.js';
import { guestErrors, publicGuestGuards, secure } from '../guests/router.js';
import { PlanStore } from './store.js';
export interface PlanOptions { store?: () => PlanStore; now?: () => number }
function input<T>(schema: { parse(v: unknown): T }, value: unknown): T { try { return schema.parse(value); } catch { throw new ExtractionError(400, 'invalid_plan_input', 'Check the public plan details, date, local time, meeting point, credential and revision. Nothing was changed.'); } }
const bearer = (req: Request) => input(guestTokenSchema, /^Bearer (.*)$/.exec(req.get('authorization') ?? '')?.[1]);
const invite = (req: Request) => input(guestTokenSchema, req.get('x-invite-token'));
function route(options: PlanOptions, work: (s: PlanStore, req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => { try { await work((options.store ?? (() => new PlanStore(database())))(), req, res); } catch (e) { if (e instanceof ExtractionError) throw e; throw new ExtractionError(503, 'plan_storage_unavailable', 'Plan storage is unavailable. Your entries were kept. Check migrations/connection and retry deliberately.'); } finally { req.body = undefined; } };
}
export function publicPlanRouter(options: PlanOptions = {}) {
  const r = Router(); r.use(publicGuestGuards(options.now), (req, _res, next) => { bearer(req); if (req.path === '/rsvp') invite(req); next(); });
  r.get('/page', route(options, async (s, req, res) => res.json(await s.page(bearer(req)))));
  r.post('/rsvps', route(options, async (s, req, res) => res.json(await s.submit(bearer(req), input(rsvpCreateSchema, req.body)))));
  r.get('/rsvp', route(options, async (s, req, res) => res.json(await s.readOwn(invite(req), bearer(req)))));
  r.put('/rsvp', route(options, async (s, req, res) => res.json(await s.edit(invite(req), bearer(req), input(rsvpEditSchema, req.body)))));
  r.use(guestErrors); return r;
}
export function organizerPlanRouter(options: PlanOptions = {}) {
  const r = Router({ mergeParams: true }); r.use(secure);
  const session = (req: Request) => input(recordId, req.params.sessionId), owner = (res: Response) => res.locals.organizer as string;
  r.get('/', route(options, async (s, req, res) => res.json(await s.get(owner(res), session(req)))));
  r.post('/select', route(options, async (s, req, res) => res.json(await s.select(owner(res), session(req), input(selectPlanSchema, req.body)))));
  r.put('/draft', route(options, async (s, req, res) => res.json(await s.save(owner(res), session(req), input(savePlanSchema, req.body)))));
  r.post('/publish', route(options, async (s, req, res) => res.json(await s.publish(owner(res), session(req), input(publishPlanSchema, req.body)))));
  r.post('/control', route(options, async (s, req, res) => res.json(await s.control(owner(res), session(req), input(controlPlanSchema, req.body)))));
  r.post('/link', route(options, async (s, req, res) => res.json(await s.link(owner(res), session(req), input(planLinkInputSchema, req.body)))));
  r.post('/revoke', route(options, async (s, req, res) => res.json(await s.revoke(owner(res), session(req), input(z.strictObject(planMutationBase), req.body)))));
  r.use(guestErrors); return r;
}
