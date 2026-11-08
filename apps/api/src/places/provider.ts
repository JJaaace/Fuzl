import { z } from 'zod';
import { candidateSchema, unknownHours, unknownPrice, normalizePlaceName, parseUsArea, usState, zoneSchema } from '@fuzl/planning';
import type { AreaChoice, PlaceCandidate, PlaceQuery, PlaceDiscovery } from '@fuzl/planning';
import { ExtractionError } from '../extraction/errors.js';
export interface VenueProvider { search(query: Pick<PlaceQuery, 'area' | 'radiusKm' | 'category' | 'resolutionId'>, signal: AbortSignal): Promise<PlaceDiscovery> }
const categories = { any: 'leisure.park,entertainment.museum,catering.restaurant,catering.cafe,entertainment.bowling_alley', park: 'leisure.park', museum: 'entertainment.museum', restaurant: 'catering.restaurant', cafe: 'catering.cafe', bowling: 'entertainment.bowling_alley' };
const upstream = () => new ExtractionError(502, 'places_invalid_response', 'The venue provider returned unsupported location or place data. No demo results were substituted.');
const placeProperties = z.object({ place_id: z.string().min(1).max(300), name: z.string().min(1).max(160), formatted: z.string().max(300).nullish(), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), categories: z.array(z.string()).optional(), city: z.string().max(100).nullish(), town: z.string().max(100).nullish(), village: z.string().max(100).nullish(), municipality: z.string().max(100).nullish(), state: z.string().max(100).nullish(), state_code: z.string().max(100).nullish(), timezone: z.object({ name: z.string() }).nullish() });
const geoResult = z.object({ formatted: z.string().min(1).max(300), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), country_code: z.literal('us'), result_type: z.enum(['unknown', 'amenity', 'building', 'street', 'suburb', 'district', 'postcode', 'city', 'county', 'state', 'country']), place_id: z.string().max(300).optional(), city: z.string().nullish(), town: z.string().nullish(), village: z.string().nullish(), municipality: z.string().nullish(), suburb: z.string().nullish(), district: z.string().nullish(), name: z.string().nullish(), state: z.string().nullish(), state_code: z.string().nullish(), postcode: z.string().nullish(), timezone: z.object({ name: z.string() }).nullish() });
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
  async resolve(query: Pick<PlaceQuery, 'area' | 'resolutionId'>, signal: AbortSignal): Promise<{ area: import('@fuzl/planning').PlaceArea } | { choices: AreaChoice[] }> {
    const requested = parseUsArea(query.area);
    if (!requested) throw new ExtractionError(400, 'area_invalid', 'Enter a US city with a valid state, or a five-digit ZIP. Leading zeros are required.');
    const geo = new URL('https://api.geoapify.com/v1/geocode/search');
    geo.searchParams.set('apiKey', this.key); geo.searchParams.set('format', 'json'); geo.searchParams.set('limit', '5'); geo.searchParams.set('filter', 'countrycode:us');
    geo.searchParams.set('type', requested.zip ? 'postcode' : 'city');
    if (requested.zip) geo.searchParams.set('postcode', requested.zip);
    else { geo.searchParams.set('city', requested.city!); if (requested.state) geo.searchParams.set('state', requested.state); }
    const geocoded = z.object({ results: z.array(geoResult).max(5) }).safeParse(await this.json(geo, signal));
    if (!geocoded.success) throw upstream();
    const plausible = geocoded.data.results.filter(r => requested.zip ? r.result_type === 'postcode' && r.postcode === requested.zip : ['city', 'suburb', 'district'].includes(r.result_type) && (!requested.state || usState(r.state_code ?? r.state ?? '') === requested.state));
    if (!plausible.length) throw new ExtractionError(422, 'area_not_found', 'No matching US city/state or ZIP was found. Check the spelling, state and all five ZIP digits.');
    const choices: AreaChoice[] = [];
    const rows = new Map<string, typeof plausible[number]>();
    for (const row of plausible) {
      const id = row.place_id ?? `area:${row.lat}:${row.lon}:${row.state_code ?? row.state ?? ''}:${row.postcode ?? ''}`;
      if (rows.has(id)) continue;
      rows.set(id, row);
      choices.push({ id, label: row.formatted, lat: row.lat, lon: row.lon, city: row.city ?? row.town ?? row.village ?? row.municipality ?? row.suburb ?? row.district ?? row.name ?? null, state: row.state_code ?? row.state ?? null, postcode: row.postcode ?? null, timeZone: zoneSchema.safeParse(row.timezone?.name).success ? row.timezone!.name : null });
    }
    const single = plausible[0];
    const exact = requested.zip || [single.city, single.town, single.village, single.municipality, single.suburb, single.district, single.name].some(n => n && normalizePlaceName(n) === normalizePlaceName(requested.city!));
    if (!query.resolutionId && (!requested.zip && !requested.state || choices.length > 1 || !exact)) return { choices };
    const location = query.resolutionId ? rows.get(query.resolutionId) : single;
    if (!location) throw new ExtractionError(422, 'area_choice_changed', 'That area choice is no longer available. Search again and choose a current area.');
    const selected = choices.find(c => c.id === (query.resolutionId ?? choices[0].id))!;
    // Choice IDs belong only to clarification. Results use the strict public
    // area contract, so do not leak an extra id into Places/Events responses.
    const area = { label: selected.label, lat: selected.lat, lon: selected.lon, city: selected.city, state: selected.state, postcode: selected.postcode, timeZone: selected.timeZone };
    return { area };
  }
  async search(query: Pick<PlaceQuery, 'area' | 'radiusKm' | 'category' | 'resolutionId'>, signal: AbortSignal): Promise<PlaceDiscovery> {
    const resolved = await this.resolve(query, signal);
    if ('choices' in resolved) return resolved;
    const { area } = resolved;
    const location = area;
    const url = new URL('https://api.geoapify.com/v2/places');
    url.searchParams.set('apiKey', this.key); url.searchParams.set('categories', categories[query.category]); url.searchParams.set('limit', '20'); url.searchParams.set('filter', `circle:${location.lon},${location.lat},${query.radiusKm * 1000}|countrycode:us`); url.searchParams.set('bias', `proximity:${location.lon},${location.lat}`);
    const data = z.object({ features: z.array(z.object({ properties: z.unknown() })).max(20) }).safeParse(await this.json(url, signal));
    if (!data.success) throw upstream();
    const retrievedAt = new Date(this.now()).toISOString();
    const candidates: PlaceCandidate[] = [];
    for (const feature of data.data.features) {
      // Unnamed POIs are not useful cards; malformed named records fail the search.
      if (typeof feature.properties === 'object' && feature.properties !== null && (!('name' in feature.properties) || feature.properties.name === null || feature.properties.name === '')) continue;
      const parsed = placeProperties.safeParse(feature.properties);
      if (!parsed.success) throw upstream();
      const p = parsed.data;
      const category = (Object.keys(categories) as (keyof typeof categories)[]).find(k => k !== 'any' && p.categories?.some(c => c === categories[k] || c.startsWith(categories[k] + '.'))) ?? 'any';
      candidates.push(candidateSchema.parse({ id: p.place_id, name: p.name, address: p.formatted ?? null, lat: p.lat, lon: p.lon, category, source: 'geoapify', sourceUrl: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`, retrievedAt, price: unknownPrice, hours: unknownHours, city: p.city ?? p.town ?? p.village ?? p.municipality ?? null, state: p.state_code ?? p.state ?? null, timeZone: zoneSchema.safeParse(p.timezone?.name).success ? p.timezone!.name : null }));
    }
    return { area, candidates };
  }
}
