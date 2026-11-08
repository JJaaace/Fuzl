import { unknownHours, unknownPrice } from './places.js';
import type { PlaceCandidate, PlaceClaim, PlaceCorrection, PlaceSearch } from './places.js';
import { normalizePlaceName } from './place-location.js';
type Evidence = NonNullable<PlaceCandidate['evidence']>;
export const emptySelection = () => ({ address: null, price: null, hours: null, 'official-link': null });
export const placeKey = (c: Pick<PlaceCandidate, 'id' | 'source'>) => `${c.source}:${c.id}`;
export const listingKey = (c: PlaceCandidate) => JSON.stringify([c.id, c.source, c.name, c.address, c.lat, c.lon, c.city ?? null, c.state ?? null, c.timeZone ?? null, c.sourceUrl, c.price, c.hours]);
export function initialEvidence(c: PlaceCandidate): Evidence {
  const source = { kind: c.source === 'geoapify' ? 'provider-listing' as const : 'organizer' as const, url: c.sourceUrl, checkedOn: c.retrievedAt.slice(0, 10), verifiedForVenue: c.source === 'demo' };
  const claims: PlaceClaim[] = [];
  if (c.address) claims.push({ id: 'listing-address', field: 'address', value: { address: c.address, city: c.city ?? null, state: c.state ?? null, lat: c.lat, lon: c.lon, timeZone: c.timeZone ?? c.hours.timeZone }, source });
  if (c.price.amount !== null) claims.push({ id: 'listing-price', field: 'price', value: c.price, addressId: 'listing-address', source });
  if (c.hours.kind !== 'unknown') claims.push({ id: 'listing-hours', field: 'hours', value: c.hours, addressId: 'listing-address', source });
  return { claims, selected: emptySelection(), listingChanged: false, confirmedOn: null };
}
export function correctedPlace(c: PlaceCandidate, corrections: PlaceCorrection[]): PlaceCandidate {
  const correction = corrections.find(v => v.candidateId === c.id && v.candidateSource === c.source);
  if (!correction) return c;
  const base = initialEvidence(c), changed = correction.listingKey !== listingKey(c);
  if (correction.selected.address && !correction.confirmedOn || correction.confirmedOn && correction.confirmedOn > new Date().toISOString().slice(0, 10)) throw Error('Address confirmation needs a valid check date.');
  if (correction.claims.some(claim => claim.source.checkedOn > new Date().toISOString().slice(0, 10))) throw Error('A source check date cannot be in the future.');
  const claims = [...base.claims, ...correction.claims];
  if (!changed && Object.entries(correction.selected).some(([field, id]) => id !== null && !claims.some(claim => claim.id === id && claim.field === field))) throw Error('A selected detail is no longer available.');
  return { ...c, evidence: { claims, selected: changed ? emptySelection() : correction.selected, listingChanged: changed, confirmedOn: correction.confirmedOn ?? null } };
}
export function placeEvidence(c: PlaceCandidate) {
  const evidence = c.evidence ?? initialEvidence(c);
  const addresses = evidence.claims.filter(v => v.field === 'address');
  const addressConflict = new Set(addresses.map(a => JSON.stringify([normalizePlaceName(a.value.address), a.value.lat, a.value.lon, a.value.timeZone]))).size > 1;
  const pick = (field: PlaceClaim['field']) => evidence.claims.find(v => v.field === field && v.id === evidence.selected[field]) ?? (evidence.claims.filter(v => v.field === field).length === 1 ? evidence.claims.find(v => v.field === field) : undefined);
  const address = pick('address');
  const confirmed = address?.field === 'address' && (evidence.selected.address === address.id || !addressConflict && address.source.verifiedForVenue) && !evidence.listingChanged;
  const price = pick('price'), hours = pick('hours'), official = pick('official-link');
  const priceConflict = evidence.claims.filter(v => v.field === 'price').length > 1 && evidence.selected.price === null;
  const hoursConflict = evidence.claims.filter(v => v.field === 'hours').length > 1 && evidence.selected.hours === null;
  const addressId = confirmed && address?.field === 'address' ? address.id : null;
  const effective: PlaceCandidate = {
    ...c,
    address: address?.field === 'address' ? address.value.address : c.address,
    city: address?.field === 'address' ? address.value.city : c.city,
    state: address?.field === 'address' ? address.value.state : c.state,
    // Never carry the old geometry/zone into a different selected address.
    lat: address?.field === 'address' ? address.value.lat : c.lat,
    lon: address?.field === 'address' ? address.value.lon : c.lon,
    timeZone: address?.field === 'address' ? address.value.timeZone : c.timeZone ?? null,
    price: price?.field === 'price' && price.addressId === addressId && addressId !== null ? price.value : unknownPrice,
    hours: hours?.field === 'hours' && hours.addressId === addressId ? hours.value : addressId === 'listing-address' && !hoursConflict ? c.hours : unknownHours,
  };
  return { evidence, recordedPrice: price?.field === 'price' ? price.value : c.price, addresses, addressConflict, addressNeedsChecking: !confirmed, addressId, priceConflict, hoursConflict, effective, official: !evidence.listingChanged && official?.field === 'official-link' && official.source.kind === 'official-page' && official.source.verifiedForVenue && official.matchNote.length >= 12 && official.value === official.source.url && official.value.startsWith('https://') ? official : null };
}

export function manualPlaces(manual: PlaceSearch['manual'], retrievedAt: string): PlaceCandidate[] { return manual.map(({ manualId, ...fields }, index) => ({ ...fields, id: manualId ?? `manual-${index}`, source: 'organizer', retrievedAt })); }
