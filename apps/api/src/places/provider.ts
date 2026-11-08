import { z } from 'zod';
import { candidateSchema, unknownHours, unknownPrice } from '@fuzl/planning';
import type { PlaceArea, PlaceCandidate, PlaceQuery } from '@fuzl/planning';
import { ExtractionError } from '../extraction/errors.js';
export interface VenueProvider { search(query: Pick<PlaceQuery, 'area' | 'radiusKm' | 'category'>, signal: AbortSignal): Promise<{ area: PlaceArea; candidates: PlaceCandidate[] }> }
const categories = { any: 'leisure.park,entertainment.museum,catering.restaurant,catering.cafe,entertainment.bowling_alley', park: 'leisure.park', museum: 'entertainment.museum', restaurant: 'catering.restaurant', cafe: 'catering.cafe', bowling: 'entertainment.bowling_alley' };
const upstream = () => new ExtractionError(502, 'places_invalid_response', 'The venue provider returned unsupported location or place data. No demo results were substituted.');
const placeProperties = z.object({ place_id: z.string().min(1).max(300), name: z.string().min(1).max(160), formatted: z.string().max(300).optional(), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), categories: z.array(z.string()).optional() });
const geoResult = z.object({ formatted: z.string().max(300), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), country_code: z.literal('us'), result_type: z.enum(['city', 'postcode']), city: z.string().optional(), state: z.string().optional(), state_code: z.string().optional(), postcode: z.string().optional(), timezone: z.object({ name: z.string() }).optional() });
export class GeoapifyProvider implements VenueProvider {
  constructor(private key: string, private request: typeof fetch = fetch, private now = Date.now) {}
  private async json(url: URL, signal: AbortSignal): Promise<unknown> {
    // URL includes the backend credential. Never log it or serialize fetch errors.
    let response: Response;
    try { response = await this.request(url, { signal, redirect: 'error', headers: { Accept: 'application/json' } }); }
    catch { throw new ExtractionError(signal.aborted ? 504 : 502, signal.aborted ? 'places_timeout' : 'places_network', signal.aborted ? 'Venue search timed out or was cancelled. Retry deliberately.' : 'Could not reach the venue provider. Your summary was kept.'); }
    if (!response.ok) {
      await response.body?.cancel();
      const status = response.status;
      throw new ExtractionError(status === 429 ? 429 : status === 401 || status === 403 ? 503 : 502, status === 429 ? 'places_quota' : status === 401 || status === 403 ? 'places_access' : 'places_http', status === 429 ? 'Geoapify quota or rate limit reached (HTTP 429). Check your Free plan dashboard and wait; no retry or paid fallback ran.' : status === 401 || status === 403 ? `Geoapify denied access (HTTP ${status}). Check the backend key and project restrictions; do not enable billing.` : `Geoapify returned HTTP ${status}. Retry deliberately after checking service availability.`);
    }
    if (!response.body) throw upstream();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > 512000) { await reader.cancel(); throw upstream(); } chunks.push(next.value); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) { if (error instanceof ExtractionError) throw error; if (signal.aborted) throw new ExtractionError(504, 'places_timeout', 'Venue search timed out. Retry deliberately.'); throw upstream(); }
  }
  async search(query: Pick<PlaceQuery, 'area' | 'radiusKm' | 'category'>, signal: AbortSignal) {
    const geo = new URL('https://api.geoapify.com/v1/geocode/search');
    geo.searchParams.set('apiKey', this.key); geo.searchParams.set('format', 'json'); geo.searchParams.set('limit', '2'); geo.searchParams.set('filter', 'countrycode:us');
    const zip = /^\d{5}$/.test(query.area);
    geo.searchParams.set('type', zip ? 'postcode' : 'city');
    if (zip) geo.searchParams.set('postcode', query.area);
    else { const [city, state] = query.area.split(',').map(s => s.trim()); geo.searchParams.set('city', city); geo.searchParams.set('state', state); }
    const geocoded = z.object({ results: z.array(geoResult).max(2) }).safeParse(await this.json(geo, signal));
    if (!geocoded.success) throw upstream();
    if (!geocoded.data.results.length) throw new ExtractionError(422, 'area_not_found', 'No US city/state or ZIP match. Check the area and retry.');
    if (geocoded.data.results.length !== 1) throw new ExtractionError(422, 'area_ambiguous', 'The search area matched multiple locations. Use a more precise city/state or ZIP. No location was silently chosen.');
    const location = geocoded.data.results[0];
    if ((zip && location.postcode !== query.area) || (!zip && (location.city?.toLowerCase() !== query.area.split(',')[0].trim().toLowerCase() || ![location.state, location.state_code].some(s => s?.toLowerCase() === query.area.split(',')[1].trim().toLowerCase())))) throw new ExtractionError(422, 'area_mismatch', 'The geocoder could not match that exact city/state or ZIP. Try a five-digit ZIP instead.');
    const url = new URL('https://api.geoapify.com/v2/places');
    url.searchParams.set('apiKey', this.key); url.searchParams.set('categories', categories[query.category]); url.searchParams.set('limit', '20'); url.searchParams.set('filter', `circle:${location.lon},${location.lat},${query.radiusKm * 1000}`); url.searchParams.set('bias', `proximity:${location.lon},${location.lat}`);
    const data = z.object({ features: z.array(z.object({ properties: z.unknown() })).max(20) }).safeParse(await this.json(url, signal));
    if (!data.success) throw upstream();
    const retrievedAt = new Date(this.now()).toISOString();
    const candidates: PlaceCandidate[] = [];
    for (const feature of data.data.features) {
      // Unnamed POIs are not useful cards; malformed named records fail the search.
      if (typeof feature.properties === 'object' && feature.properties !== null && !('name' in feature.properties)) continue;
      const parsed = placeProperties.safeParse(feature.properties);
      if (!parsed.success) throw upstream();
      const p = parsed.data;
      const category = (Object.keys(categories) as (keyof typeof categories)[]).find(k => k !== 'any' && p.categories?.some(c => c === categories[k] || c.startsWith(categories[k] + '.'))) ?? 'any';
      candidates.push(candidateSchema.parse({ id: p.place_id, name: p.name, address: p.formatted ?? null, lat: p.lat, lon: p.lon, category, source: 'geoapify', sourceUrl: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`, retrievedAt, price: unknownPrice, hours: unknownHours }));
    }
    let timeZone: string | null = location.timezone?.name ?? null;
    try { if (timeZone) new Intl.DateTimeFormat('en-US', { timeZone }); } catch { timeZone = null; }
    return { area: { label: location.formatted, lat: location.lat, lon: location.lon, timeZone }, candidates };
  }
}
