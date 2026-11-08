import { eventRouter } from '../events/router.js';
import type { EventsOptions } from '../events/router.js';
import { placeRouter } from '../places/router.js';
import type { PlacesOptions } from '../places/router.js';
import { organizerGuestRouter } from '../guests/router.js';
import type { GuestOptions } from '../guests/router.js';
import { Router, json } from 'express';
import type { Request, Response } from 'express';
import { groupInputSchema, groupUpdateSchema, recordId, sessionInputSchema, sessionUpdateSchema } from '@fuzl/planning';
import { ExtractionError } from '../extraction/errors.js';
import { publicAccountConfiguration, verifyOrganizer } from './auth.js';
import type { VerifyOrganizer } from './auth.js';
import { database } from './database.js';
import { OrganizerStore } from './store.js';
export function accountRouter(options: { events?: EventsOptions; places?: PlacesOptions; guests?: GuestOptions; verify?: VerifyOrganizer; store?: () => OrganizerStore } = {}) {
  const router = Router();
  router.get('/account-config', (_request, response) => response.set('Cache-Control', 'no-store').json(publicAccountConfiguration()));
  const privateRoutes = Router();
  privateRoutes.use(async (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    try {
      const origin = request.get('origin');
      const allowed = process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : ['http://127.0.0.1:5173', 'http://localhost:5173'];
      if (origin && !allowed.includes(origin)) throw new ExtractionError(403, 'origin_rejected', 'This origin cannot access saved work.');
      const token = /^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(request.get('authorization') ?? '')?.[1];
      if (!token) throw new ExtractionError(401, 'sign_in_required', 'Sign in to access private saved work.');
      response.locals.organizer = await (options.verify ?? verifyOrganizer)(token);
      next();
    } catch (error) { next(error); }
  });
  privateRoutes.use((request, _response, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && !request.is('application/json')) return next(new ExtractionError(415, 'json_required', 'Send saved changes as JSON.'));
    next();
  }, json({ limit: '1mb', inflate: false }));
  function route(work: (store: OrganizerStore, subject: string, request: Request, response: Response) => Promise<unknown>) {
    return async (request: Request, response: Response) => {
      try { await work((options.store ?? (() => new OrganizerStore(database())))(), response.locals.organizer as string, request, response); }
      catch (error) {
        if (error instanceof ExtractionError) throw error;
        // Never serialize/log a DB/auth exception: it may contain data or URLs.
        const code = typeof error === 'object' && error && 'code' in error ? error.code : null;
        throw new ExtractionError(code === 'P2034' ? 409 : 503, code === 'P2034' ? 'save_conflict' : 'storage_unavailable',
          code === 'P2034' ? 'Concurrent changes prevented this save. Your edits were kept. Reopen the latest session or save a new copy.' : 'Saved storage is unavailable. Your edits were kept; check database setup/migrations and retry deliberately.');
      } finally { request.body = undefined; }
    };
  }
  const id = (value: unknown) => {
    const result = recordId.safeParse(value); if (!result.success) throw new ExtractionError(400, 'invalid_id', 'The saved item reference is invalid.'); return result.data;
  };
  const input = <T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, value: unknown): T => {
    const result = schema.safeParse(value); if (!result.success) throw new ExtractionError(400, 'invalid_saved_input', 'Check the name, summary fields, source references and revision. No saved data was changed.'); return result.data;
  };
  privateRoutes.get('/groups', route(async (store, subject, _request, response) => response.json(await store.listGroups(subject))));
  privateRoutes.post('/groups', route(async (store, subject, request, response) => response.status(201).json(await store.createGroup(subject, input(groupInputSchema, request.body)))));
  privateRoutes.put('/groups/:id', route(async (store, subject, request, response) => response.json(await store.updateGroup(subject, id(request.params.id), input(groupUpdateSchema, request.body)))));
  privateRoutes.delete('/groups/:id', route(async (store, subject, request, response) => { await store.deleteGroup(subject, id(request.params.id)); response.status(204).end(); }));
  privateRoutes.get('/groups/:id/sessions', route(async (store, subject, request, response) => response.json(await store.listSessions(subject, id(request.params.id)))));
  privateRoutes.post('/groups/:id/sessions', route(async (store, subject, request, response) => response.status(201).json(await store.createSession(subject, id(request.params.id), input(sessionInputSchema, request.body)))));
  privateRoutes.get('/sessions/:id', route(async (store, subject, request, response) => response.json(await store.getSession(subject, id(request.params.id)))));
  privateRoutes.put('/sessions/:id', route(async (store, subject, request, response) => {
    const value = input(sessionUpdateSchema, request.body);
    response.json(await store.updateSession(subject, id(request.params.id), value.groupId, value.revision, value.payload));
  }));
  privateRoutes.delete('/sessions/:id', route(async (store, subject, request, response) => { await store.deleteSession(subject, id(request.params.id)); response.status(204).end(); }));
  privateRoutes.use('/sessions/:sessionId/events', eventRouter(options.events));
  privateRoutes.use('/sessions/:sessionId/places', placeRouter(options.places));
  privateRoutes.use('/sessions/:sessionId/guest', organizerGuestRouter(options.guests));
  router.use('/private', privateRoutes);
  return router;
}
