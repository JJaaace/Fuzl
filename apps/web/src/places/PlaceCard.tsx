import { newRecordId } from '@fuzl/planning';
import SavedIdeaSource from '../ideas/SavedIdeaSource';
import RecordedVisit from '../adjustments/RecordedVisit';
import { useShortlist } from '../ballots/context';
import { moneyText, shortlistPlace } from '@fuzl/planning';
import DiscoveryChecks from './DiscoveryChecks';
import { placeEvidence } from '@fuzl/planning';
import type { PlaceCorrection } from '@fuzl/planning';
import PlaceEvidenceEditor from './PlaceEvidenceEditor';
import type { AssessedPlace } from '@fuzl/planning';
export default function PlaceCard({ place, balanceReason, busy = false, onReview, onSaveLater }: { balanceReason?: boolean; onSaveLater?: () => void; place: AssessedPlace; busy?: boolean; onReview?: (correction: PlaceCorrection) => boolean }) {
  const onShortlist = useShortlist();
  const c = place.candidate, details = placeEvidence(c), current = details.effective, p = details.recordedPrice, h = current.hours;
  return <article className={`place-card fit-${place.status}`}><div className="fact-heading"><h4>{c.name}</h4><span className="badge">{place.status === 'fits' ? 'Fits checked constraints' : place.status === 'does-not-fit' ? 'Doesn’t fit' : 'Needs checking'}</span></div>
    <p>{current.address ?? 'Address unknown'}</p><p className="note">Venue location: {[current.city, current.state].filter(Boolean).join(', ') || 'City/state not supplied'}</p>{details.addressNeedsChecking && <p className="notice"><strong>Address needs checking</strong>{details.addressConflict && ' · Sources disagree. Review both values below.'}</p>}{c.source === 'geoapify' && <p className="note">Provider-reported location; confirm the venue’s current address before traveling.</p>}<p>{place.reason}</p>
    {balanceReason && <p className="note">Helps balance travel across recent outings.</p>}{place.discovery && <p className="note discovery-reason">{place.discovery.reason}</p>}
    {place.memory && <aside className="notice group-memory"><strong>Group memory · not current venue evidence</strong><p>{place.memory.reason}</p><p className="note">A small preference only; current constraints and unresolved details still apply.</p></aside>}
    <dl><dt>Price</dt><dd>{p.amount === null ? 'Price unknown' : moneyText(p.amount,p.currency)} · {p.basis} · {p.coverage === 'admission-only' ? 'Admission only; other expenses unknown' : p.coverage === 'total' ? 'Supplied total cost' : 'Total coverage unknown'}</dd>{p.amount !== null && current.price.amount === null && <dd>Price location needs checking; this amount cannot establish affordability yet.</dd>}<dt>Hours</dt><dd>{h.kind === 'unknown' ? 'Hours unknown' : `${h.kind === 'regular' ? 'Regular hours only' : h.date + ' · ' + (h.timeZone ?? 'zone unknown')}: ${h.closed ? 'Closed' : h.start && h.end ? h.start + '–' + h.end : h.text ?? 'Details unknown'}`}</dd><dt>Venue-local time</dt><dd>{place.localWindow ?? `Window unresolved · ${current.timeZone ?? 'Venue time zone unknown'}`}</dd><dt>Booking availability</dt><dd>{current.visit?.booking ? 'See the organizer-recorded access check below; this is not a reservation' : 'Seats, tickets and reservations unverified'}</dd><dt>Travel</dt><dd>{place.distanceKm === null ? 'Distance unknown' : `${place.distanceKm.toFixed(1)} km straight-line from area center`} · {current.visit?.travel ? 'Organizer-recorded travel estimate below; check that it applies' : 'Travel time unknown'}</dd></dl><RecordedVisit evidence={current.visit}/>
    <p className="note">{c.source === 'demo' ? 'Synthetic demo fixture' : c.source === 'organizer' ? 'Organizer-entered details; not provider-verified' : 'Geoapify / OpenStreetMap data'} · {new Date(c.retrievedAt).toLocaleString()}</p>
    <p><strong>Next: {place.nextStep}</strong></p>{c.sourceUrl ? <a className="place-next" href={c.sourceUrl} target="_blank" rel="noreferrer">{c.source === 'geoapify' ? 'Open original provider map' : 'Open supplied source'} ↗</a> : <p className="note">No external source link supplied.</p>}<p className="note">{c.source === 'geoapify' ? 'Map pin only; it does not verify an address, price, hours or official website.' : 'Source link supplied with these details.'}</p>
    {c.savedIdea && <SavedIdeaSource origin={c.savedIdea.origin} checkedOn={c.savedIdea.lastCheckedOn}/>}
    {onSaveLater && <button onClick={onSaveLater}>Save for later</button>}
    {details.official && <p><a href={details.official.value} target="_blank" rel="noreferrer">Official venue page — organizer matched</a><span className="note"> · Checked {details.official.source.checkedOn} · {details.official.matchNote}</span></p>}
    {onReview && <PlaceEvidenceEditor candidate={c} disabled={busy} onReview={onReview} />}
    {onShortlist && <button onClick={() => onShortlist(() => shortlistPlace(place, newRecordId()))}>Add to shortlist</button>}
    <DiscoveryChecks checks={place.checks} ranking={place.ranking} />
  </article>;
}
