import { Router } from 'express';
import type { Request } from 'express';
import { candidateSchema, demoPlaces, evaluatePlaces, placeResultsSchema, placeSearchSchema, recordId } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { ExtractionError } from '../extraction/errors.js';
import { GeoapifyProvider } from './provider.js';
import type { VenueProvider } from './provider.js';
import { PlaceStore } from './store.js';
import type { PlaceContextStore } from './store.js';
export interface PlacesOptions { store?: () => PlaceContextStore; provider?: VenueProvider; now?: () => number }
export function placeRouter(options: PlacesOptions = {}) {
  const router = Router({ mergeParams: true });
  let active = false, attempts = 0;
  const recent: number[] = [];
  router.post('/search', async (req, res) => {
    res.set({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' });
    const parsed = placeSearchSchema.safeParse(req.body), id = recordId.safeParse((req as Request).params.sessionId);
    if (!parsed.success || !id.success) throw new ExtractionError(400, 'invalid_places_input', 'Use a US City, State or five-digit ZIP, a 1–30 km radius and valid applied summary/search details.');
    const input = parsed.data;
    const store = (options.store ?? (() => new PlaceStore(database())))();
    const controller = new AbortController();
    const abort = () => controller.abort();
    res.once('close', abort);
    let ownsLiveSlot = false;
    try {
      const subject = res.locals.organizer as string;
      const context = await store.context(subject, id.data, input);
      const now = (options.now ?? Date.now)();
      let found;
      if (input.mode === 'demo') {
        try { found = demoPlaces(input.query, new Date(now).toISOString()); }
        catch { throw new ExtractionError(422, 'demo_area', 'Demo results cover Columbus, OH / 43210 and Cleveland, OH / 44114. Use live search for another US area.'); }
      } else {
        if (!options.provider && (process.env.VENUE_SEARCH_ENABLED !== 'true' || !process.env.GEOAPIFY_API_KEY)) throw new ExtractionError(503, 'places_unconfigured', 'Live places are not configured. Set GEOAPIFY_API_KEY and VENUE_SEARCH_ENABLED=true privately in apps/api/.env, verify the Free plan, then restart the API. Demo results still work.');
        while (recent.length && now - recent[0] >= 60000) recent.shift();
        if (active || attempts >= 10 || recent.length >= 2) throw new ExtractionError(429, 'places_local_limit', 'Live search limit reached: one in flight, two per minute and ten attempts per API process. Wait or review setup before restarting; no automatic retry ran.');
        active = true; ownsLiveSlot = true; attempts++; recent.push(now);
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
        // Intentionally build a new allowlisted provider input. No summary,
        // names, private/public budgets, date, excerpts, or images cross it.
        found = await (options.provider ?? new GeoapifyProvider(process.env.GEOAPIFY_API_KEY!)).search({ area: input.query.area, radiusKm: input.query.radiusKm, category: input.query.category }, signal);
      }
      if (controller.signal.aborted) return;
      const latest = await store.context(subject, id.data, input);
      if (latest.version !== context.version) throw new ExtractionError(409, 'places_context_changed', 'Session answers changed during the search. Review them and search again; no stale shortlist was accepted.');
      const retrievedAt = new Date((options.now ?? Date.now)()).toISOString();
      const manual = input.manual.map((candidate, index) => candidateSchema.parse({ ...candidate, id: 'manual-' + index, source: 'organizer', retrievedAt }));
      const result = placeResultsSchema.parse({ mode: input.mode, retrievedAt, ...evaluatePlaces([...found.candidates, ...manual], found.area, input.query, input.summary, latest.privateSpending) });
      res.json(result);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ExtractionError) throw error;
      // Raw provider/DB exceptions can contain keys, URLs or private values.
      throw new ExtractionError(503, 'places_unavailable', 'Places search could not complete. Your summary was kept. Check setup/migrations and retry deliberately; no fallback results were used.');
    } finally { if (ownsLiveSlot) active = false; res.removeListener('close', abort); req.body = undefined; }
  });
  return router;
}
