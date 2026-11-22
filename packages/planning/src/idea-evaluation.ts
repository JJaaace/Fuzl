import { assessPlaces, budgetCheck, current, settled } from './place-evaluation.js';
import type { PrivateSpending } from './place-evaluation.js';
import { proposalFactUsable, proposalWindow } from './plan-proposals.js';
import type { PlanningSummary } from './model.js';
import type { PlaceCandidate, AssessedPlace } from './places.js';
export function assessIdeaOptions(candidates: PlaceCandidate[], summary: PlanningSummary, context: {
    privateSpending?: PrivateSpending[];
    memories?: Parameters<typeof assessPlaces>[5];
    history?: Parameters<typeof assessPlaces>[6];
    participation?: Parameters<typeof assessPlaces>[7];
    travel?: Parameters<typeof assessPlaces>[8];
} = {}) {
    const window = proposalWindow(summary), query = { area: '', radiusKm: 5, category: 'any' as const, date: window.date, start: window.start, end: window.end, timeZone: null };
    const assessed = assessPlaces(candidates, null, query, summary, context.privateSpending ?? [], context.memories, context.history, context.participation, context.travel);
    const all: AssessedPlace[] = [...assessed.verified, ...assessed.promising, ...assessed.excluded];
    for (const item of all) {
        const original = candidates.find(c => c.id === item.candidate.id)!;
        const limits = summary.facts.filter(f => current(f) && f.kind === 'budget' && proposalFactUsable(f, summary) && f.strength === 'firm' && (settled(f) || f.extraction && !f.extraction.reviewed && f.extraction.reportedStatus === 'confirmed'));
        const failures = limits.flatMap(f => f.kind === 'budget' ? [{ ...budgetCheck(original, f, 'budget', true), ...(f.extraction && !f.extraction.reviewed ? { detail: 'Known total cost exceeds a source-reported firm limit. The underlying AI claim remains unreviewed.' } : {}) }] : []).filter(c => c.status === 'does-not-fit');
        if (context.privateSpending?.some(limit => limit.state === 'known' && budgetCheck(original, limit, 'private-budget', true).status === 'does-not-fit'))
            failures.push({ kind: 'private-budget', status: 'does-not-fit', detail: 'Private spending check: this option does not fit. Individual limits stay private.' });
        if (failures.length) {
            item.checks.push(...failures);
            item.status = 'does-not-fit';
        }
        if (window.conflict) {
            item.checks.push({ kind: 'timing', status: 'does-not-fit', detail: 'Recorded availability conflicts. Review the existing windows before choosing for everyone.' });
            item.status = 'does-not-fit';
        }
    }
    return all;
}
