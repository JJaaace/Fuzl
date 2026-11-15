import type { PlanDetails } from '@fuzl/planning';
type Props = { details: PlanDetails; sample?: boolean };
// One set of approved fields is shared by organizer previews and the guest page.
export function PlanEssentials({ details: d, sample = false }: Props) {
  return <div className="plan-essentials">{sample && <strong className="badge">Sample plan — synthetic data</strong>}<dl><dt>Date & local time</dt><dd>{d.date ?? 'Date required'} · {d.time ?? 'Time required'}{d.endTime ? `–${d.endTime}` : ' · End / duration unknown'} · {d.timeZone ?? 'Time zone required'}</dd><dt>Meeting point</dt><dd>{d.meetingPoint ?? 'Meeting point required'}</dd><dt>Cost</dt><dd>{d.cost.amount === null ? 'Cost unknown' : `${d.cost.kind === 'starting' ? 'Starting at' : d.cost.kind === 'total' ? 'Organizer-supplied total' : 'Listed amount; total unknown'} ${d.cost.amount} ${d.cost.currency ?? '(currency unknown)'}`} · {d.cost.basis}</dd>{d.attendanceScope && <><dt>Intended attendance scope</dt><dd>{d.attendanceScope.mode === 'everyone' ? 'Everyone together' : 'Who’s available?'} · {d.attendanceScope.count} intended people. Opt-in is separate from RSVP or actual attendance.</dd></>}</dl></div>;
}
export function PlanEvidence({ details: d }: Props) {
  return <div className="plan-evidence"><dl><dt>Booking</dt><dd>{d.booking === 'needs-booking' ? 'Group agreed; booking / tickets still need arranging' : d.booking === 'organizer-reported-booked' ? 'Organizer reports booking arranged; verify tickets, seats and conditions' : 'Booking status unknown'}</dd></dl>{d.instructions && <><h4>Instructions</h4><p className="plan-instructions">{d.instructions}</p></>}{!!d.links.length && <ul>{d.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a></li>)}</ul>}<h4>Still needs checking</h4>{d.unresolved.length ? <ul>{d.unresolved.map((u, i) => <li key={i}>{u}</li>)}</ul> : <p>No additional checks recorded. Confirmation does not book tickets, verify availability or guarantee attendance.</p>}<p className="note">A published agreement is not a reservation, payment, ticket or calendar booking.</p></div>;
}
export default function Details({ details: d, sample = false }: Props) {
  return <article className="place-card plan-details"><h3>{d.activity}</h3><PlanEssentials details={d} sample={sample}/><PlanEvidence details={d}/></article>;
}
