import { participationChecks } from './participation.js';
import type { ParticipationScope } from './participation-contract.js';
import { discoveryEvidence } from './discovery.js';
import type { GroupVisitHistory } from './discovery.js';
import { travelCheck, bookingCheck, retainedVisitChecks } from './visit-evidence.js';
import { memoryInfluence } from './memory.js';
import type { GroupMemory } from './memory.js';
import { attributed, budgetCheck, current, reviewed, settled, straightLineKm } from './place-evaluation.js';
import type { PrivateSpending } from './place-evaluation.js';
import { localInstant } from './place-location.js';
import type { PlanningSummary } from './model.js';
import type { PlaceArea } from './places.js';
import type { AssessedEvent, EventCheck, EventQuery, EventResults, ScheduledEvent } from './events.js';

export function evaluateEvents(events: ScheduledEvent[], area: PlaceArea, query: EventQuery, summary: PlanningSummary, privateSpending: PrivateSpending[] = [], memories: GroupMemory[] = [], history?: GroupVisitHistory, participation?: ParticipationScope): Pick<EventResults, 'ranked' | 'verified' | 'promising' | 'excluded' | 'notices'> {
  const facts = summary.facts.filter(current), budgets = facts.filter(f => f.kind === 'budget');
  const seen = new Set<string>(), urls = new Set<string>(), ranked: AssessedEvent[] = [];
  for (const raw of events) {
    const event = retainedVisitChecks(raw, summary);
    if (seen.has(event.id) || (event.sourceUrl !== null && urls.has(event.sourceUrl))) continue;
    seen.add(event.id); if (event.sourceUrl !== null) urls.add(event.sourceUrl);
    const s = event.schedule, checks: EventCheck[] = participationChecks(participation, { date: event.schedule.date, start: event.schedule.time, end: event.schedule.endDate === event.schedule.date ? event.schedule.endTime : null, timeZone: event.schedule.timeZone }, summary, area.timeZone), distanceKm = straightLineKm(area, event.venue);
    const check = (kind: EventCheck['kind'], status: EventCheck['status'], detail: string, blocking = true) => checks.push({ kind, status, detail, blocking });
    const knownStatus = ['onsale', 'offsale', 'scheduled'].includes(event.providerStatus ?? '');
    check('event-status', ['canceled', 'cancelled'].includes(event.providerStatus ?? '') ? 'does-not-fit' : knownStatus ? 'fits' : 'needs-checking', ['canceled', 'cancelled'].includes(event.providerStatus ?? '') ? 'Cancelled event excluded.' : knownStatus ? 'Provider-reported schedule status; ticket availability remains separate.' : 'Status unknown, postponed or rescheduled. Confirm the current date and status before shortlisting as verified.');
    check('address', event.source === 'demo' && event.venue.address && event.venue.name ? 'fits' : 'needs-checking', 'Using the event listing’s venue, not a verified official venue page. Confirm the current address before going.');
    check('radius', distanceKm === null ? 'needs-checking' : distanceKm <= query.radiusKm ? 'fits' : 'does-not-fit', 'Straight-line distance from the resolved area center. It does not establish driving time.');
    const dated = !!s.date && !s.dateUncertain;
    check('timing', !dated ? 'needs-checking' : s.date! < query.from || s.date! > query.to ? 'does-not-fit' : 'fits', 'Compared the listed event-local date with the inclusive search dates. A search date does not confirm anyone’s availability.');
    const instant = dated && s.time && s.timeZone && !s.timeUncertain && !s.zoneConflict ? localInstant(s.date!, s.time, s.timeZone) : null;
    const endInstant = s.endDate && s.endTime && s.timeZone && !s.zoneConflict ? localInstant(s.endDate, s.endTime, s.timeZone) : null;
    if (s.endDate && s.endTime && (endInstant === null || instant === null || endInstant < instant)) check('timing', 'needs-checking', 'Reported end time conflicts with the start or has an ambiguous local clock. Confirm duration.');
    const utcConflict = instant !== null && s.utcStart !== null && Math.floor(Date.parse(s.utcStart) / 60000) !== Math.floor(instant / 60000);
    check('timing', instant === null || utcConflict ? 'needs-checking' : 'fits', instant === null || utcConflict ? 'Start time or time zone is missing, uncertain, conflicting or ambiguous at a daylight-saving transition. A date-only listing is not a known start time.' : 'Known start time in the event’s reported local time zone.');
    const price = { amount: event.price.amount, currency: event.price.currency, basis: event.price.basis, coverage: event.price.kind === 'total' && event.price.fees === 'included' ? 'total' as const : 'unknown' as const };
    if (!budgets.length) check('budget', 'needs-checking', 'No reviewed spending limit. Unknown is not zero or unlimited.');
    for (const b of budgets) {
      if (!settled(b) || !attributed(b, summary) || b.strength === 'unknown') check('budget', 'needs-checking', 'Budget is unreviewed, unconfirmed, conflicting, tentative or unattributed.');
      else if (b.strength === 'firm') checks.push(budgetCheck({ price }, b, 'budget', true));
    }
    if (event.price.kind !== 'total' || event.price.fees !== 'included' || price.amount === null || price.currency === null || price.basis !== 'per-person') check('budget', 'needs-checking', 'Listed starting prices are not a total. Verify fees, ticket tier and total per-person cost; unavailable prices stay unknown.');
    if (privateSpending.length) {
      const statuses = privateSpending.map(b => budgetCheck({ price }, b.state === 'known' ? b : { amount: null, currency: null }, 'private-budget', true).status);
      check('private-budget', statuses.includes('does-not-fit') ? 'does-not-fit' : statuses.includes('needs-checking') ? 'needs-checking' : 'fits', 'Private spending check: only a general result is disclosed; individual limits stay private.');
    }
    for (const f of facts.filter(f => f.kind !== 'budget')) {
      if (!reviewed(f) || !settled(f) || !attributed(f, summary) || f.strength === 'unknown') { check('constraint', 'needs-checking', 'A planning answer is unreviewed, tentative, conflicting, incomplete or unattributed. Search controls leave that fact unchanged.'); continue; }
      if (f.kind === 'schedule') {
        if (!f.exactDate || !f.startTime || !f.endTime) check('timing', 'needs-checking', 'Planning availability is incomplete; choosing search dates does not resolve unknown dates or clock bounds.');
        if (f.exactDate && f.strength === 'flexible' && f.subject.kind === 'group') {
          check('timing', !dated || instant === null || s.timeZone !== area.timeZone || !f.startTime || !f.endTime || !s.endDate || !s.endTime ? 'needs-checking' : s.date !== f.exactDate || s.endDate !== f.exactDate || s.time! < f.startTime || s.endTime > f.endTime ? 'does-not-fit' : 'fits', 'Compare the fixed event schedule with the current explicitly flexible group outing window. Only the organizer can adjust that window.');
        }
        if (f.exactDate && f.strength === 'firm') {
          // Planning clocks have no zone field. Compare only when the event and
          // selected area's reliable zones agree; never assume a participant zone.
          if (!dated || !s.timeZone || s.timeZone !== area.timeZone || instant === null || utcConflict) check('timing', 'needs-checking', 'Cannot compare firm planning availability across unknown, ambiguous or different time zones.');
          else if (s.date !== f.exactDate || f.startTime && s.time! < f.startTime || f.endTime && s.time! > f.endTime) check('timing', 'does-not-fit', 'Event starts outside a confirmed firm availability window in the selected area’s time zone.');
          else if (f.endTime && (!s.endDate || !s.endTime)) check('timing', 'needs-checking', 'Event starts within availability, but its end time is unknown. Confirm the full duration.');
          else if (f.endTime && (s.endDate !== f.exactDate || s.endTime! > f.endTime)) check('timing', 'does-not-fit', 'Event ends outside the confirmed firm availability window.');
          else check('timing', 'fits', 'Event schedule is within the confirmed firm availability supplied.');
        }
      } else if (f.kind === 'travel') checks.push(travelCheck(f, event.visit, { date: s.date, start: s.time, end: s.endTime, timeZone: s.timeZone }, event.venue.address, participation ? participation.roster.filter(p => p.selected).map(p => p.id) : summary.participants.length ? summary.participants.map(p => p.id) : undefined));
      else if (f.strength === 'firm') check('constraint', 'needs-checking', 'Firm activity, accessibility, age, diet or other free-text requirements need specific evidence; event categories do not prove them.');
    }
    if (summary.questions.some(q => q.resolution === null)) check('constraint', 'needs-checking', 'Open planning questions remain unresolved.');
    checks.push(bookingCheck(event.visit, { date: s.date, start: s.time, end: s.endTime, timeZone: s.timeZone }, event.venue.address, participation ? participation.roster.filter(p => p.selected).map(p => p.id) : summary.participants.length ? summary.participants.map(p => p.id) : undefined));
    if (!facts.some(f => f.kind === 'travel')) check('travel', 'needs-checking', 'Travel time unknown; no duration limit was supplied.', false);
    const status = checks.some(c => c.blocking !== false && c.status === 'does-not-fit') ? 'does-not-fit' : checks.some(c => c.blocking !== false && c.status === 'needs-checking') ? 'needs-checking' : 'fits';
    const memory = memoryInfluence(event.sourceUrl, memories);
    ranked.push({ event, discovery: discoveryEvidence(event.sourceUrl, memory, history, !!event.savedIdea), ...(memory ? { memory } : {}), status, checks, distanceKm, reason: status === 'fits' ? 'Fits the checked planning constraints; ticket availability still needs checking.' : status === 'does-not-fit' ? 'Excluded by a known status, boundary or firm constraint.' : 'A scheduled option with unresolved checks; it is not a confirmed plan.', nextStep: checks.find(c => c.blocking !== false && c.status !== 'fits')?.detail ?? 'Check tickets, current status and group capacity on the specific listing.' });
  }
  ranked.sort((a, b) => (a.status === 'fits' ? 0 : a.status === 'needs-checking' ? 1 : 2) - (b.status === 'fits' ? 0 : b.status === 'needs-checking' ? 1 : 2) || Number(!['scheduled', 'onsale', 'offsale'].includes(a.event.providerStatus ?? '')) - Number(!['scheduled', 'onsale', 'offsale'].includes(b.event.providerStatus ?? '')) || (b.checks.filter(c => c.status === 'fits').length + (b.memory?.boost ?? 0)) - (a.checks.filter(c => c.status === 'fits').length + (a.memory?.boost ?? 0)) || (a.event.schedule.date ?? '').localeCompare(b.event.schedule.date ?? '') || a.event.id.localeCompare(b.event.id));
  const useful = ranked.filter(e => e.status !== 'does-not-fit').slice(0, 3);
  return { ranked, verified: useful.filter(e => e.status === 'fits'), promising: useful.filter(e => e.status === 'needs-checking'), excluded: ranked.filter(e => e.status === 'does-not-fit'), notices: ['Up to three useful options from one provider page; this is not a complete local events calendar.', 'Starting price, fees, total cost and ticket availability are separate. Suggestions are never reservations.', ...(facts.some(f => !reviewed(f)) ? ['AI claims remain unreviewed and do not verify or exclude events.'] : [])] };
}
