import { Router, json } from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import { guestTokenSchema, inviteInputSchema, recordId, responseCreateSchema, responseUpdateSchema } from '@fuzl/planning';
import { ExtractionError } from '../extraction/errors.js';
import { database } from '../accounts/database.js';
import { GuestStore } from './store.js';
export interface GuestOptions {
    store?: () => GuestStore;
    now?: () => number;
}
const input = <T>(schema: {
    parse(v: unknown): T;
}, value: unknown): T => { try {
    return schema.parse(value);
}
catch {
    throw new ExtractionError(400, 'invalid_guest_input', 'Check the title, questions, name, answers and revision. No response was changed.');
} };
const token = (value: string | undefined) => input(guestTokenSchema, /^Bearer (.*)$/.exec(value ?? '')?.[1]);
const secure = (_request: Request, response: Response, next: () => void) => { response.set({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', Vary: 'Authorization, X-Invite-Token' }); next(); };
function route(options: GuestOptions, work: (store: GuestStore, request: Request, response: Response) => Promise<unknown>) {
    return async (request: Request, response: Response) => {
        try {
            await work((options.store ?? (() => new GuestStore(database())))(), request, response);
        }
        catch (error) {
            if (error instanceof ExtractionError)
                throw error;
            throw new ExtractionError(503, 'guest_storage_unavailable', 'Guest storage is unavailable. Your typed answers were kept. Check migrations/connection and retry deliberately.');
        }
        finally {
            request.body = undefined;
        }
    };
}
const errors: ErrorRequestHandler = (error: unknown, request, response, next) => {
    void next;
    request.body = undefined;
    if (error instanceof ExtractionError) {
        response.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
    }
    const large = typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large';
    response.status(large ? 413 : 400).json({ error: { code: large ? 'guest_too_large' : 'invalid_guest_input', message: large ? 'This form exceeds its size limit. Shorten the answers and retry.' : 'The form could not be read. Check the fields and retry.' } });
};
export function publicGuestRouter(options: GuestOptions = {}) {
    const router = Router();
    const windows = new Map<string, {
        time: number;
        reads: number;
        writes: number;
    }>();
    router.use(secure, (request, response, next) => {
        const origin = request.get('origin');
        const allowed = process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : ['http://127.0.0.1:5173', 'http://localhost:5173'];
        if (origin && !allowed.includes(origin))
            throw new ExtractionError(403, 'origin_rejected', 'This origin cannot submit guest answers.');
        const now = (options.now ?? Date.now)();
        const key = request.ip ?? 'local';
        for (const [id, value] of windows)
            if (now - value.time >= 60000)
                windows.delete(id);
        if (!windows.has(key) && windows.size >= 10000)
            throw new ExtractionError(429, 'guest_rate_limit', 'Guest requests are busy. Wait one minute and retry deliberately.');
        const counts = windows.get(key) ?? { time: now, reads: 0, writes: 0 };
        windows.set(key, counts);
        const kind = request.method === 'GET' ? 'reads' : 'writes';
        counts[kind]++;
        if (counts[kind] > (kind === 'reads' ? 60 : 12)) {
            response.set('Retry-After', '60');
            throw new ExtractionError(429, 'guest_rate_limit', 'Too many guest requests. Wait one minute, then retry deliberately. Your typed answers were kept.');
        }
        if (request.method !== 'GET' && !request.is('application/json'))
            throw new ExtractionError(415, 'json_required', 'Submit answers as JSON.');
        next();
    }, json({ limit: '16kb', inflate: false }), (request, _response, next) => {
        token(request.get('authorization'));
        if (request.path === '/response') input(guestTokenSchema, request.get('x-invite-token'));
        next();
    });
    router.get('/form', route(options, async (store, req, res) => res.json(await store.form(token(req.get('authorization'))))));
    router.post('/responses', route(options, async (store, req, res) => res.json(await store.submit(token(req.get('authorization')), input(responseCreateSchema, req.body)))));
    router.get('/response', route(options, async (store, req, res) => res.json(await store.readOwn(input(guestTokenSchema, req.get('x-invite-token')), token(req.get('authorization'))))));
    router.put('/response', route(options, async (store, req, res) => res.json(await store.edit(input(guestTokenSchema, req.get('x-invite-token')), token(req.get('authorization')), input(responseUpdateSchema, req.body)))));
    router.use(errors);
    return router;
}
// Mounted only after the existing private router verifies the organizer.
export function organizerGuestRouter(options: GuestOptions = {}) {
    const router = Router({ mergeParams: true });
    router.use(secure);
    const session = (req: Request) => input(recordId, req.params.sessionId);
    const owner = (res: Response) => res.locals.organizer as string;
    router.get('/invite', route(options, async (store, req, res) => res.json(await store.inviteInfo(owner(res), session(req)))));
    router.post('/invite', route(options, async (store, req, res) => res.status(201).json(await store.createInvite(owner(res), session(req), input(inviteInputSchema, req.body)))));
    router.delete('/invite', route(options, async (store, req, res) => { await store.revoke(owner(res), session(req)); res.status(204).end(); }));
    router.get('/responses', route(options, async (store, req, res) => res.json(await store.replies(owner(res), session(req)))));
    router.use(errors);
    return router;
}
