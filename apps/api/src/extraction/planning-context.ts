import { verifyOrganizer } from '../accounts/auth.js';
import type { VerifyOrganizer } from '../accounts/auth.js';
import { database } from '../accounts/database.js';
import { PlaceStore } from '../places/store.js';
import type { PlaceContextStore, SearchContext } from '../places/store.js';
import type { PlanProposalRequest } from '@fuzl/planning';
import { ExtractionError } from './errors.js';
export interface PlanningContextOptions {
    verify?: VerifyOrganizer;
    store?: () => PlaceContextStore;
}
export async function planningContext(input: Pick<PlanProposalRequest, 'summary' | 'saved'>, headers: {
    authorization?: string;
    origin?: string;
}, options: PlanningContextOptions = {}) {
    let store: PlaceContextStore | undefined, subject: string | undefined;
    let context: SearchContext = { version: 'temporary', privateSpending: [] };
    if (input.saved) {
        const allowed = process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : ['http://127.0.0.1:5173', 'http://localhost:5173'];
        if (headers.origin && !allowed.includes(headers.origin))
            throw new ExtractionError(403, 'origin_rejected', 'This origin cannot access saved work.');
        const token = /^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(headers.authorization ?? '')?.[1];
        if (!token)
            throw new ExtractionError(401, 'sign_in_required', 'Sign in to use this saved session.');
        subject = await (options.verify ?? verifyOrganizer)(token);
        store = (options.store ?? (() => new PlaceStore(database())))();
        context = await store.context(subject, input.saved.id, { summary: input.summary, sessionRevision: input.saved.revision });
    }
    else if (input.summary.facts.some(f => f.guest) || input.summary.questions.some(q => q.guest))
        throw new ExtractionError(400, 'saved_context_required', 'Applied guest answers require their owned saved-session context.');
    return { context, checkCurrent: async () => { if (store && subject && input.saved) {
            const latest = await store.context(subject, input.saved.id, { summary: input.summary, sessionRevision: input.saved.revision });
            if (latest.version !== context.version)
                throw new ExtractionError(409, 'planning_stale', 'Saved facts, answers or attendance changed. Reopen the current session and try again.');
        } } };
}
