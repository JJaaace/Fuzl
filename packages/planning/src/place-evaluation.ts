import type { PlanningFact, PlanningSummary } from './model.js';
import type { AssessedPlace, FitCheck, PlaceArea, PlaceCandidate, PlaceQuery, PlaceResults } from './places.js';
// Only the server supplies these. They never appear in a result DTO.
export interface PrivateSpending { amount: number | null; currency: string | null; state: string }
export function straightLineKm(area: PlaceArea, candidate: PlaceCandidate): number | null {
  if (candidate.lat === null || candidate.lon === null) return null;
  const rad = (n: number) => n * Math.PI / 180;
  const x = Math.sin(rad(candidate.lat - area.lat) / 2) ** 2 + Math.cos(rad(area.lat)) * Math.cos(rad(candidate.lat)) * Math.sin(rad(candidate.lon - area.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
}
const current = (f: PlanningFact) => f.extraction?.scope !== 'historical';
const reviewed = (f: PlanningFact) => !f.extraction || f.extraction.reviewed;
const settled = (f: PlanningFact) => reviewed(f) && f.status === 'confirmed';
function attributed(fact: PlanningFact, summary: PlanningSummary) {
  const subject = fact.subject;
  return subject.kind === 'group' || (subject.kind === 'participant' && summary.participants.some(p => p.id === subject.participantId)) || (subject.kind === 'speaker' && summary.speakers.some(s => s.id === subject.speakerId && s.participantId !== null));
}
function budgetCheck(candidate: PlaceCandidate, limit: { amount: number | null; currency: string | null }, kind: 'budget' | 'private-budget', firm: boolean): FitCheck {
  const p = candidate.price;
  let status: FitCheck['status'] = 'needs-checking';
  if (limit.amount !== null && limit.currency !== null && p.amount !== null && p.currency === limit.currency && p.basis === 'per-person' && p.coverage === 'total') status = p.amount <= limit.amount ? 'fits' : firm ? 'does-not-fit' : 'needs-checking';
  // No amount, respondent, threshold, currency, or count in private explanations.
  const detail = kind === 'private-budget' ? 'Private spending check: only a general result is disclosed; individual limits stay private.'
    : status === 'fits' ? 'Known total per-person cost is within a confirmed limit in the same currency.'
      : status === 'does-not-fit' ? 'Known total per-person cost exceeds a confirmed firm limit.'
        : 'Affordability needs checking: match total cost, per-person basis, currency and a settled limit. Admission alone or a price tier is insufficient.';
  return { kind, status, detail };
}
export function evaluatePlaces(candidates: PlaceCandidate[], area: PlaceArea, query: PlaceQuery, summary: PlanningSummary, privateSpending: PrivateSpending[] = []): Omit<PlaceResults, 'mode' | 'retrievedAt'> {
  const facts = summary.facts.filter(current);
  const budgets = facts.filter(f => f.kind === 'budget');
  const seenIds = new Set<string>(), seenUrls = new Set<string>();
  const ranked: { result: AssessedPlace; score: number }[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.source}:${candidate.id}`;
    if (seenIds.has(key) || seenUrls.has(candidate.sourceUrl)) continue;
    seenIds.add(key); seenUrls.add(candidate.sourceUrl);
    const checks: FitCheck[] = [];
    const distanceKm = straightLineKm(area, candidate);
    checks.push({ kind: 'travel', status: distanceKm === null ? 'needs-checking' : distanceKm <= query.radiusKm ? 'fits' : 'does-not-fit', detail: distanceKm === null ? 'Position unknown; verify the search boundary.' : 'Straight-line distance from the search-area center, not a route, departure point or travel-time estimate.' });
    if (query.category !== 'any') checks.push({ kind: 'constraint', status: candidate.category === 'any' ? 'needs-checking' : candidate.category === query.category ? 'fits' : 'does-not-fit', detail: 'Compare the supplied category with the chosen search category; an unknown category remains unchecked.' });
    if (!budgets.length) checks.push({ kind: 'budget', status: 'needs-checking', detail: 'No reviewed spending limit is available. Missing does not mean zero or unlimited.' });
    for (const budget of budgets) {
      if (!settled(budget) || budget.strength === 'unknown' || !attributed(budget, summary)) {
        checks.push({ kind: 'budget', status: 'needs-checking', detail: 'A spending answer is unreviewed, tentative, conflicting, unconfirmed or not clearly attributed. Keep it unresolved.' });
      } else if (budget.strength === 'firm') checks.push(budgetCheck(candidate, budget, 'budget', true));
      // Flexible budgets affect ranking below, never act as a hard exclusion.
    }
    if (privateSpending.length) {
      const statuses = privateSpending.map(limit => budgetCheck(candidate, limit.state === 'known' ? limit : { amount: null, currency: null }, 'private-budget', true).status);
      checks.push({ kind: 'private-budget', status: statuses.includes('does-not-fit') ? 'does-not-fit' : statuses.includes('needs-checking') ? 'needs-checking' : 'fits', detail: 'Private spending check: only a general result is disclosed; individual limits stay private.' });
    }
    if (summary.questions.some(q => q.resolution === null)) checks.push({ kind: 'constraint', status: 'needs-checking', detail: 'Open planning questions remain unresolved; verify their relevance before deciding.' });
    if (!checks.some(c => c.kind === 'budget') && (candidate.price.amount === null || candidate.price.currency === null || candidate.price.basis !== 'per-person' || candidate.price.coverage !== 'total')) checks.push({ kind: 'budget', status: 'needs-checking', detail: 'Total per-person cost is not established, even where the budget is flexible.' });
    const h = candidate.hours;
    const completeTime = !!query.date && !!query.start && !!query.end && !!query.timeZone;
    const dated = completeTime && h.kind === 'date-specific' && h.date === query.date && h.timeZone === query.timeZone;
    checks.push({ kind: 'timing', status: dated ? h.closed || h.start! > query.start! || h.end! < query.end! ? 'does-not-fit' : 'fits' : 'needs-checking', detail: dated ? 'Checked the chosen local date/window against supplied date-specific hours in the same time zone. Seats/tickets remain unverified.' : 'Choose an exact date, start/end and time zone, and confirm date-specific hours. Regular hours alone do not verify this outing.' });
    if (area.timeZone && query.timeZone && area.timeZone !== query.timeZone) checks.push({ kind: 'timing', status: 'needs-checking', detail: 'Chosen time zone differs from the search area. Confirm the intended local times.' });
    for (const fact of facts.filter(f => f.kind !== 'budget')) {
      if (!reviewed(fact) || fact.status === 'tentative' || fact.status === 'conflicting') {
        checks.push({ kind: 'constraint', status: 'needs-checking', detail: 'Unreviewed AI or tentative/conflicting planning information remains unresolved; it is not verified evidence.' }); continue;
      }
      if (!attributed(fact, summary)) { checks.push({ kind: 'constraint', status: 'needs-checking', detail: 'A planning requirement has unknown attribution. Confirm its subject before treating it as verified.' }); continue; }
      if (fact.kind === 'schedule') {
        if (!settled(fact) || !fact.exactDate || !fact.startTime || !fact.endTime) checks.push({ kind: 'timing', status: 'needs-checking', detail: 'A planning date/time is incomplete or unconfirmed. Search timing does not silently resolve that answer.' });
        else if (fact.strength === 'firm' && completeTime && (fact.exactDate !== query.date || query.start! < fact.startTime || query.end! > fact.endTime)) checks.push({ kind: 'timing', status: 'does-not-fit', detail: 'Chosen search timing falls outside a confirmed firm planning window. Change the plan explicitly before using this window.' });
      } else if (fact.kind === 'travel') {
        checks.push({ kind: 'travel', status: 'needs-checking', detail: 'Travel duration/mode has not been measured. Radius and straight-line distance cannot verify a drive-time or other travel limit.' });
      } else if (fact.strength === 'unknown') {
        checks.push({ kind: 'constraint', status: 'needs-checking', detail: 'The firmness of an activity or preference is unknown. Confirm whether it is required before treating it as satisfied.' });
      } else if (fact.strength === 'firm') {
        const exactCategory = fact.kind === 'activity' ? fact.description?.trim().toLowerCase() : null;
        checks.push({ kind: 'constraint', status: settled(fact) && exactCategory && ['park', 'museum', 'restaurant', 'cafe', 'bowling'].includes(exactCategory) && candidate.category !== 'any' ? exactCategory === candidate.category ? 'fits' : 'does-not-fit' : 'needs-checking', detail: 'Firm activity or other requirements need matching evidence. Free-text accessibility, age, diet, capacity and other requirements are not inferred from categories.' });
      }
    }
    const status = checks.some(c => c.status === 'does-not-fit') ? 'does-not-fit' : checks.some(c => c.status === 'needs-checking') ? 'needs-checking' : 'fits';
    const matches = facts.filter(f => settled(f) && attributed(f, summary) && f.strength === 'flexible' && f.kind === 'activity' && f.description?.trim().toLowerCase() === candidate.category).length;
    const flexibleBudgetFits = budgets.filter(b => settled(b) && attributed(b, summary) && b.strength === 'flexible' && budgetCheck(candidate, b, 'budget', false).status === 'fits').length;
    const known = checks.filter(c => c.status === 'fits').length;
    const ranking = [`${matches} exact activity preference match${matches === 1 ? '' : 'es'}`, `${known} checks supported by supplied details`, distanceKm === null ? 'Proximity unknown' : `${distanceKm.toFixed(1)} km straight-line from area center`];
    const reason = status === 'fits' ? 'The supplied details satisfy the checked constraints; this is a suggestion, not a reservation.' : status === 'does-not-fit' ? 'A firm constraint or search boundary excludes this option.' : matches ? 'Matches a reviewed activity preference; unresolved checks remain.' : 'A candidate in the chosen area; verify the unresolved details before deciding.';
    const nextStep = checks.some(c => c.kind === 'budget' && c.status !== 'fits') ? 'Check total per-person prices' : checks.some(c => c.kind === 'private-budget' && c.status !== 'fits') ? 'Review private spending feasibility' : checks.some(c => c.kind === 'timing' && c.status !== 'fits') ? 'Confirm date-specific hours' : checks.some(c => c.status !== 'fits') ? 'Check remaining requirements' : 'Confirm seats, tickets or reservation availability';
    // Hard eligibility is sorted before these transparent preference tie-breakers.
    ranked.push({ result: { candidate, status, checks, reason, nextStep, distanceKm, ranking }, score: matches * 10 + flexibleBudgetFits * 3 + known - (distanceKm ?? query.radiusKm) / 100 });
  }
  ranked.sort((a, b) => (a.result.status === 'fits' ? 0 : a.result.status === 'needs-checking' ? 1 : 2) - (b.result.status === 'fits' ? 0 : b.result.status === 'needs-checking' ? 1 : 2) || b.score - a.score || a.result.candidate.id.localeCompare(b.result.candidate.id));
  const useful = ranked.filter(r => r.result.status !== 'does-not-fit').slice(0, 3).map(r => r.result);
  return { area, verified: useful.filter(r => r.status === 'fits'), promising: useful.filter(r => r.status === 'needs-checking'), excluded: ranked.filter(r => r.result.status === 'does-not-fit').map(r => r.result), notices: ['Results cover only the returned candidates, not every place in the area.', 'Hours do not establish seats, tickets, group capacity or reservations. Suggestions are not confirmed plans.', ...(facts.some(f => !reviewed(f)) ? ['Unreviewed AI claims remain unreviewed and were not used as verified constraints or ranking preferences.'] : []), ...(summary.questions.some(q => !q.resolution) ? ['Open questions remain unresolved; check them before deciding.'] : [])] };
}
