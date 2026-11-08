import { PlaceSearchCache, searchBoundaryKey } from './cache.js';
import { Router } from 'express';
import type { Request } from 'express';
import { candidateSchema, manualPlaces, correctedPlace, demoPlaces, evaluatePlaces, placeClarificationSchema, placeResultsSchema, placeSearchSchema, placeRecheckSchema, recordId } from '@fuzl/planning';
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
  const cache = new PlaceSearchCache(options.now);
  router.post(['/search', '/evaluate'], async (req, res) => {
    res.set({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' });
    const recheck = req.path === '/evaluate';
    const parsed = (recheck ? placeRecheckSchema : placeSearchSchema).safeParse(req.body), id = recordId.safeParse((req as Request).params.sessionId);
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
      if (recheck) {
        const snapshot = cache.get((input as import('@fuzl/planning').PlaceSearch & { searchId: string }).searchId, subject, id.data);
        if (snapshot.revision !== input.sessionRevision || snapshot.contextVersion !== context.version || snapshot.queryKey !== searchBoundaryKey(input.query) || snapshot.mode !== input.mode) throw new ExtractionError(409, 'places_snapshot_changed', 'The search boundary, saved revision or private answers changed. Your details were kept; review and run a fresh search.');
        found = { area: snapshot.area, candidates: snapshot.candidates };
      } else if (input.mode === 'demo') {
        try { found = demoPlaces(input.query, new Date(now).toISOString()); }
        catch { throw new ExtractionError(422, 'demo_area', 'No demo fixture matches this location or choice. Try Boston, MA / 02108, Brookline, MA / 02445, Marfa, TX / 79843, Springfield, or the existing Ohio examples.'); }
      } else {
        if (!options.provider && (process.env.VENUE_SEARCH_ENABLED !== 'true' || !process.env.GEOAPIFY_API_KEY)) throw new ExtractionError(503, 'places_unconfigured', 'Live places are not configured. Set GEOAPIFY_API_KEY and VENUE_SEARCH_ENABLED=true privately in apps/api/.env, verify the Free plan, then restart the API. Demo results still work.');
        while (recent.length && now - recent[0] >= 60000) recent.shift();
        if (active || attempts >= 10 || recent.length >= 2) throw new ExtractionError(429, 'places_local_limit', 'Live search limit reached: one in flight, two per minute and ten attempts per API process. Wait or review setup before restarting; no automatic retry ran.');
        active = true; ownsLiveSlot = true; attempts++; recent.push(now);
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
        // Intentionally build a new allowlisted provider input. No summary,
        // names, private/public budgets, date, excerpts, or images cross it.
        found = await (options.provider ?? new GeoapifyProvider(process.env.GEOAPIFY_API_KEY!)).search({ area: input.query.area, radiusKm: input.query.radiusKm, category: input.query.category, ...(input.query.resolutionId ? { resolutionId: input.query.resolutionId } : {}) }, signal);
      }
      if (controller.signal.aborted) return;
      const latest = await store.context(subject, id.data, input);
      if (latest.version !== context.version) throw new ExtractionError(409, 'places_context_changed', 'Session answers changed during the search. Review them and search again; no stale shortlist was accepted.');
      const retrievedAt = new Date((options.now ?? Date.now)()).toISOString();
      if ('choices' in found) {
        res.json(placeClarificationSchema.parse({ kind: 'clarification', mode: input.mode, choices: found.choices, message: 'Choose a resolved area or add a state/ZIP. These are up to five plausible matches, not an exhaustive list; no venue search ran yet.' })); return;
      }
      const searchId = recheck ? (input as import('@fuzl/planning').PlaceSearch & { searchId: string }).searchId : cache.put({ subject, sessionId: id.data, revision: input.sessionRevision, contextVersion: latest.version, queryKey: searchBoundaryKey(input.query), area: found.area, candidates: found.candidates, mode: input.mode });
      const manual = manualPlaces(input.manual, retrievedAt);
      const all = [...found.candidates, ...manual].map(candidate => candidateSchema.parse(correctedPlace(candidate, input.corrections ?? [])));
      const result = placeResultsSchema.parse({ mode: input.mode, searchId, coverage: found.candidates.length === 0 ? 'empty' : found.candidates.length < 3 ? 'sparse' : 'available', retrievedAt, ...evaluatePlaces(all, found.area, input.query, input.summary, latest.privateSpending) });
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
