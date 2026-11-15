import { Router } from 'express';
import type { Request, Response } from 'express';
import { recordId, backupSaveSchema, backupPreviewInputSchema, backupSwitchSchema } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { ExtractionError } from '../extraction/errors.js';
import { secure, guestErrors } from '../guests/router.js';
import { BackupStore } from './store.js';
export interface BackupOptions { store?: () => BackupStore }
function parse<T>(schema: { parse(value: unknown): T }, value: unknown) { try { return schema.parse(value); } catch { throw new ExtractionError(400, 'invalid_backup_input', 'Check backup details, clear date/local clocks/zone, meeting point, public links and current revisions. No switch was made.'); } }
export function backupRouter(options: BackupOptions = {}) {
  const router = Router({ mergeParams: true }); router.use(secure);
  const route = (work: (store: BackupStore, subject: string, sessionId: string, req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
    try { const store = (options.store ?? (() => new BackupStore(database())))(); res.json(await work(store, res.locals.organizer as string, parse(recordId, req.params.sessionId), req)); }
    catch (e) { if (e instanceof ExtractionError) throw e; throw new ExtractionError(503, 'backup_storage_unavailable', 'Backup storage is unavailable. Entries were kept; reload deliberately after checking migrations/connection. No automatic retry or provider request ran.'); }
    finally { req.body = undefined; }
  };
  router.get('/', route((s, subject, id) => s.get(subject, id)));
  router.put('/', route((s, subject, id, req) => s.save(subject, id, parse(backupSaveSchema, req.body))));
  router.post('/preview', route((s, subject, id, req) => s.preview(subject, id, parse(backupPreviewInputSchema, req.body))));
  router.post('/switch', route((s, subject, id, req) => s.switch(subject, id, parse(backupSwitchSchema, req.body))));
  router.use(guestErrors); return router;
}
