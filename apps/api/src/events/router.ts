import { Router } from 'express';
import type { Request } from 'express';
import { demoEvents, evaluateEvents, eventSearchSchema, eventResponseSchema, recordId, scheduledEventSchema } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { PlaceStore } from '../places/store.js';
import type { PlaceContextStore } from '../places/store.js';
import { GeoapifyProvider } from '../places/provider.js';
import { ExtractionError } from '../extraction/errors.js';
import { TicketmasterProvider } from './provider.js';
import type { AreaResolver, EventProvider } from './provider.js';
export interface EventsOptions { store?: () => PlaceContextStore; resolver?: AreaResolver; provider?: EventProvider; now?: () => number }
export function eventRouter(options: EventsOptions = {}) {
  const router = Router({ mergeParams: true });
  let active = false, attempts = 0; const recent: number[] = [];
  router.post('/search', async (req, res) => {
    res.set({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' });
    const parsed = eventSearchSchema.safeParse(req.body), id = recordId.safeParse((req as Request).params.sessionId);
    if (!parsed.success || !id.success) throw new ExtractionError(400, 'invalid_events_input', 'Choose a US city/state or five-digit ZIP, a 1–30 km radius and explicit search dates (at most 31 days). Apply open planning edits first.');
    const input = parsed.data, subject = res.locals.organizer as string;
    const controller = new AbortController(), abort = () => controller.abort(); res.once('close', abort);
    let ownsSlot = false;
    try {
      const store = (options.store ?? (() => new PlaceStore(database())))();
      const context = await store.context(subject, id.data, input), now = (options.now ?? Date.now)();
      let found;
      if (input.mode === 'demo') {
        try { found = demoEvents(input.query, new Date(now).toISOString()); }
        catch { throw new ExtractionError(422, 'demo_event_area', 'No event fixture for this area. Try Boston, MA / 02108, Columbus, OH / 43210, Marfa, TX / 79843 or Springfield.'); }
      } else {
        if ((!options.provider && (process.env.EVENT_SEARCH_ENABLED !== 'true' || !process.env.TICKETMASTER_API_KEY)) || (!options.resolver && (process.env.VENUE_SEARCH_ENABLED !== 'true' || !process.env.GEOAPIFY_API_KEY))) throw new ExtractionError(503, 'events_unconfigured', 'Live events need TICKETMASTER_API_KEY and EVENT_SEARCH_ENABLED=true plus the existing Geoapify configuration, privately in apps/api/.env. Restart the API. Demo events work without keys.');
        while (recent.length && now - recent[0] >= 60000) recent.shift();
        if (active || attempts >= 10 || recent.length >= 2) throw new ExtractionError(429, 'events_local_limit', 'Live event search is limited to one in flight, two per minute and ten attempts per API process. No retry or fallback ran.');
        active = true; ownsSlot = true; attempts++; recent.push(now);
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
        // Resolve only. Do not perform an unrelated venue search, and never pass
        // conversation, summary, participant or budget fields to either provider.
        const resolved = await (options.resolver ?? new GeoapifyProvider(process.env.GEOAPIFY_API_KEY!)).resolve({ area: input.query.area, ...(input.query.resolutionId ? { resolutionId: input.query.resolutionId } : {}) }, signal);
        if ('choices' in resolved) found = resolved;
        else {
          const events = await (options.provider ?? new TicketmasterProvider(process.env.TICKETMASTER_API_KEY!)).search({ lat: resolved.area.lat, lon: resolved.area.lon, radiusKm: input.query.radiusKm, from: input.query.from, to: input.query.to }, signal);
          found = { area: resolved.area, events: events.map(e => scheduledEventSchema.parse(e)) };
        }
      }
      if (controller.signal.aborted) return;
      const latest = await store.context(subject, id.data, input);
      if (latest.version !== context.version) throw new ExtractionError(409, 'events_context_changed', 'Saved planning or private answers changed during the search. Review and search again; no stale event shortlist was accepted.');
      if ('choices' in found) { res.json(eventResponseSchema.parse({ kind: 'clarification', mode: input.mode, choices: found.choices, message: 'Choose the intended resolved area. No event provider request has run yet.' })); return; }
      res.json(eventResponseSchema.parse({ mode: input.mode, area: found.area, query: input.query, retrievedAt: new Date((options.now ?? Date.now)()).toISOString(), ...evaluateEvents(found.events, found.area, input.query, input.summary, latest.privateSpending) }));
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ExtractionError) throw error;
      throw new ExtractionError(503, 'events_unavailable', 'Event search could not complete safely. Your plan was kept. Check configuration and retry deliberately; no fallback events were used.');
    } finally { if (ownsSlot) active = false; res.removeListener('close', abort); req.body = undefined; }
  });
  return router;
}
