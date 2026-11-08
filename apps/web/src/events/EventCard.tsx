import type { AssessedEvent } from '@fuzl/planning';
import DiscoveryChecks from '../places/DiscoveryChecks';
export default function EventCard({ result }: { result: AssessedEvent }) {
  const { event: e } = result, s = e.schedule, p = e.price;
  return <article className={`place-card event-card fit-${result.status}`}><div className="fact-heading"><h4>{e.title}</h4><span className="badge">{result.status === 'fits' ? 'Fits checked constraints' : result.status === 'does-not-fit' ? 'Doesn’t fit' : 'Needs checking'}</span></div>
    <p>{result.reason}</p><dl><dt>Where</dt><dd>{e.venue.name ?? 'Venue unknown'} · {e.venue.address ?? 'Address unknown'} · {[e.venue.city, e.venue.state].filter(Boolean).join(', ') || 'City/state unknown'}</dd>
      <dt>When (event-local)</dt><dd>{s.date ?? 'Date unknown'}{s.dateUncertain && ' · Date tentative / TBA'} · {s.time ? `${s.time}${s.timeUncertain ? ' (time uncertain)' : ''}` : 'Date-only listing · Start time unknown'} · {s.timeZone ?? 'Time zone unknown'}{s.zoneConflict && ' · Time zones disagree'}</dd><dt>End</dt><dd>{s.endDate && s.endTime ? `${s.endDate} ${s.endTime}` : 'End time / duration unknown'}</dd>
      <dt>Provider-reported status</dt><dd>{e.providerStatus ?? 'Status unknown'}</dd><dt>Price</dt><dd>{p.amount === null ? 'Price unknown' : `${p.kind === 'starting' ? 'Starting at ' : p.kind === 'total' ? 'Known total ' : ''}${p.amount} ${p.currency ?? '(currency unknown)'}`} · {p.basis}</dd><dt>Fees / total</dt><dd>{p.fees === 'included' && p.kind === 'total' ? 'Fees included in supplied total' : 'Fees and total cost unresolved'}</dd><dt>Ticket availability</dt><dd>Unknown · Onsale does not confirm available tickets or group capacity</dd><dt>Travel</dt><dd>{result.distanceKm === null ? 'Distance unknown' : `${result.distanceKm.toFixed(1)} km straight-line from area center`} · Travel time unknown</dd></dl>
    <p className="note">{e.source === 'demo' ? 'Synthetic event fixture — not a real event' : 'Ticketmaster Discovery listing — provider reported'} · Retrieved {new Date(e.retrievedAt).toLocaleString()}</p>
    <p><strong>Next: {result.nextStep}</strong></p><a className="place-next" href={e.sourceUrl} target="_blank" rel="noreferrer">{e.source === 'demo' ? 'Example source (fixture only)' : 'Open specific event / ticket listing'} ↗</a><DiscoveryChecks checks={result.checks} />
  </article>;
}
