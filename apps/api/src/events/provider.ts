import { z } from 'zod';
import { scheduledEventSchema, zoneSchema } from '@fuzl/planning';
import type { EventQuery, PlaceArea, ScheduledEvent } from '@fuzl/planning';
import { ExtractionError } from '../extraction/errors.js';
export type EventProviderQuery = Pick<EventQuery, 'radiusKm' | 'from' | 'to'> & { lat: number; lon: number };
export interface EventProvider { search(query: EventProviderQuery, signal: AbortSignal): Promise<ScheduledEvent[]> }
export interface AreaResolver { resolve(query: Pick<EventQuery, 'area' | 'resolutionId'>, signal: AbortSignal): Promise<{ area: PlaceArea } | { choices: import('@fuzl/planning').AreaChoice[] }> }
// Ticketmaster documents geoPoint (geohash); latlong is deprecated. Stable
// 9-character precision encodes the resolved center, not a participant location.
export function geoHash(lat: number, lon: number): string {
  const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
  const ranges = [[-180, 180], [-90, 90]], values = [lon, lat];
  let hash = '', value = 0;
  for (let bit = 0; bit < 45; bit++) {
    const axis = bit % 2, range = ranges[axis], middle = (range[0] + range[1]) / 2;
    const high = values[axis] >= middle;
    value = value * 2 + Number(high); range[high ? 0 : 1] = middle;
    if (bit % 5 === 4) { hash += alphabet[value]; value = 0; }
  }
  return hash;
}
const text = z.string().max(300).nullish();
const start = z.object({ localDate: text, localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/).nullish(), dateTime: text, dateTBD: z.boolean().optional(), dateTBA: z.boolean().optional(), timeTBA: z.boolean().optional(), noSpecificTime: z.boolean().optional() });
const rawEvent = z.object({ id: z.string().min(1).max(300), name: z.string().min(1).max(300), url: z.string().url(), dates: z.object({ start: start.optional(), end: start.optional(), timezone: text, status: z.object({ code: z.string().max(100) }).optional() }).optional(), priceRanges: z.array(z.object({ min: z.number().min(0).max(1000000).optional(), max: z.number().min(0).max(1000000).optional(), currency: text })).max(30).optional(), _embedded: z.object({ venues: z.array(z.object({ name: z.string().max(160).nullish(), address: z.object({ line1: text, line2: text, line3: text }).optional(), city: z.object({ name: z.string().max(100) }).optional(), state: z.object({ stateCode: z.string().max(100) }).optional(), timezone: text, location: z.object({ latitude: z.string().regex(/^-?\d+(\.\d+)?$/), longitude: z.string().regex(/^-?\d+(\.\d+)?$/) }).optional() })).max(20) }).optional() });
const invalid = () => new ExtractionError(502, 'events_invalid_response', 'The event provider returned malformed or unsupported data. No demo events were substituted.');
export class TicketmasterProvider implements EventProvider {
  constructor(private key: string, private request: typeof fetch = fetch, private now = Date.now) {}
  async search(q: EventProviderQuery, signal: AbortSignal): Promise<ScheduledEvent[]> {
    const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
    for (const [key, value] of Object.entries({ apikey: this.key, geoPoint: geoHash(q.lat, q.lon), radius: String(q.radiusKm), unit: 'km', countryCode: 'US', localStartDateTime: `${q.from}T00:00:00,${q.to}T23:59:59`, size: '20', page: '0', sort: 'date,asc', includeTBA: 'yes', includeTBD: 'yes' })) url.searchParams.set(key, value);
    let response: Response;
    // The URL and upstream error bodies can contain the API key. Never log or
    // return them, nor serialize a fetch exception. No redirects or retries.
    try { response = await this.request(url, { signal, redirect: 'error', headers: { Accept: 'application/json' } }); }
    catch { throw new ExtractionError(signal.aborted ? 504 : 502, signal.aborted ? 'events_timeout' : 'events_network', signal.aborted ? 'Event search timed out or was cancelled. Retry deliberately.' : 'Could not reach Ticketmaster. Your plan was kept.'); }
    if (!response.ok) {
      await response.body?.cancel(); const status = response.status;
      throw new ExtractionError(status === 429 ? 429 : [401, 403].includes(status) ? 503 : 502, status === 429 ? 'events_quota' : [401, 403].includes(status) ? 'events_access' : 'events_http', status === 429 ? 'Ticketmaster quota/rate limit reached (HTTP 429). Wait and check your public API quota. No retry or paid fallback ran.' : [401, 403].includes(status) ? `Ticketmaster denied access (HTTP ${status}). Check the backend key and account permissions.` : `Ticketmaster returned HTTP ${status}. Retry deliberately after checking availability.`);
    }
    try {
      if (!response.body) throw invalid();
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
      while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > 1000000) { await reader.cancel(); throw invalid(); } chunks.push(next.value); }
      const payload = z.object({ page: z.object({ totalElements: z.number().int().min(0) }), _embedded: z.object({ events: z.array(rawEvent).max(20) }).optional() }).refine(p => p.page.totalElements === 0 || !!p._embedded?.events.length).parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      return (payload._embedded?.events ?? []).map(e => {
        const link = new URL(e.url);
        // Only return the provider's specific listing, never API URLs, embedded
        // credentials, or arbitrary redirects. Preserve normal affiliate params.
        if (!['https:', 'http:'].includes(link.protocol) || link.username || link.password || !['ticketmaster.com', 'ticketmaster.ca', 'livenation.com', 'universe.com', 'frontgatetickets.com', 'ticketweb.com'].some(d => link.hostname === d || link.hostname.endsWith('.' + d)) || link.pathname === '/' || [...link.searchParams.keys()].some(k => /key|token|secret|authorization/i.test(k))) throw invalid();
        const v = e._embedded?.venues?.length === 1 ? e._embedded.venues[0] : undefined;
        const dates = e.dates, s = dates?.start, end = dates?.end;
        const eventZone = zoneSchema.safeParse(dates?.timezone), venueZone = zoneSchema.safeParse(v?.timezone);
        const zoneConflict = !!dates?.timezone && !eventZone.success || !!v?.timezone && !venueZone.success || eventZone.success && venueZone.success && eventZone.data !== venueZone.data;
        const priceRows = e.priceRanges ?? [], currencies = new Set(priceRows.map(p => p.currency ?? null));
        const known = priceRows.filter(p => p.min !== undefined);
        const price = currencies.size === 1 && known.length === priceRows.length && known.length ? { amount: Math.min(...known.map(p => p.min!)), currency: priceRows[0].currency ?? null, kind: 'starting', basis: 'per-person', fees: 'unknown' } : { amount: null, currency: null, kind: 'unknown', basis: 'unknown', fees: 'unknown' };
        return scheduledEventSchema.parse({ id: e.id, title: e.name, source: 'ticketmaster', sourceUrl: e.url, retrievedAt: new Date(this.now()).toISOString(), providerStatus: dates?.status?.code ?? null,
          venue: { name: v?.name ?? null, address: [v?.address?.line1, v?.address?.line2, v?.address?.line3].filter(Boolean).join(', ') || null, city: v?.city?.name ?? null, state: v?.state?.stateCode ?? null, lat: v?.location ? Number(v.location.latitude) : null, lon: v?.location ? Number(v.location.longitude) : null },
          schedule: { date: s?.localDate ?? null, time: s?.localTime ? s.localTime.slice(0, 5) : null, endDate: end?.dateTBD || end?.dateTBA ? null : end?.localDate ?? null, endTime: end?.timeTBA || end?.noSpecificTime ? null : end?.localTime ? end.localTime.slice(0, 5) : null, timeZone: eventZone.success ? eventZone.data : venueZone.success ? venueZone.data : null, utcStart: s?.dateTime ?? null, dateUncertain: !!s?.dateTBD || !!s?.dateTBA, timeUncertain: !!s?.timeTBA || !!s?.noSpecificTime, zoneConflict }, price });
      });
    } catch (error) { if (error instanceof ExtractionError) throw error; if (signal.aborted) throw new ExtractionError(504, 'events_timeout', 'Event search timed out. Retry deliberately.'); throw invalid(); }
  }
}
