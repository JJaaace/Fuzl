import { Router } from 'express';
import type { Request, Response } from 'express';
import { recordId, travelSetupEditSchema, travelHistoryEditSchema } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { TravelStore } from './store.js';
import { ExtractionError } from '../extraction/errors.js';
import { secure, guestErrors } from '../guests/router.js';
export interface TravelOptions { store?: () => TravelStore }
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ExtractionError(400, 'invalid_travel_input', 'Check one-way minutes (0–360 or blank), explicit attendance, member mappings, sources, dates and revisions.');
  return result.data;
}
export function travelRouter(options: TravelOptions = {}) {
  const router = Router({ mergeParams: true });
  router.use(secure);
  const route = (work: (store: TravelStore, subject: string, sessionId: string, request: Request) => Promise<unknown>) => async (request: Request, response: Response) => {
    try {
      const sessionId = parse(recordId, request.params.sessionId);
      const store = (options.store ?? (() => new TravelStore(database())))();
      response.json(await work(store, response.locals.organizer as string, sessionId, request));
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      throw new ExtractionError(503, 'travel_storage_unavailable', 'Private travel records are unavailable. Entries were kept; check migrations and retry deliberately.');
    } finally { request.body = undefined; }
  };
  router.get('/', route((store, subject, sessionId) => store.get(subject, sessionId)));
  router.put('/', route((store, subject, sessionId, request) => store.save(subject, sessionId, parse(travelSetupEditSchema, request.body))));
  router.put('/history', route((store, subject, sessionId, request) => store.history(subject, sessionId, parse(travelHistoryEditSchema, request.body))));
  router.use(guestErrors);
  return router;
}
