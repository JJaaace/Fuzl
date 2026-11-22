import { proposalFactUsable, unknownHours } from '@fuzl/planning';
import type { PlanProposalRequest, PlanningSummary } from '@fuzl/planning';
type Manual = PlanProposalRequest['manual'][number];
const catalog = [['Bowling', 'bowling'], ['Café catch-up', 'cafe'], ['Park walk', 'park'], ['Museum visit', 'museum'], ['Board-game session', 'any'], ['Shared meal', 'restaurant']] as const;
export interface IdeaChoice {
    candidate: Manual;
    reason: string;
    art: string;
}
export function ideaChoices(summary: PlanningSummary, sampleId: string | undefined, page: number): IdeaChoice[] {
    const sample = sampleId === 'conflicts' ? [['Museum visit', 'museum'], ['Park walk', 'park'], ['Board-game session', 'any']] as const : catalog;
    const proposed = summary.facts.filter(f => f.kind === 'activity' && proposalFactUsable(f, summary) && !f.guest).map(f => f.kind === 'activity' ? f.description!.split(/\s+[—–]\s+/)[0] : '').filter(Boolean);
    let choices: {
        name: string;
        category: Manual['category'];
        reason: string;
    }[] = page === 0 ? proposed.slice(0, 3).map(name => ({ name, category: /bowling/i.test(name) ? 'bowling' : /hike|walk/i.test(name) ? 'park' : 'any', reason: 'An activity already proposed in the conversation; its remaining details still need checking.' })) : [];
    for (let n = 0; n < sample.length && choices.length < 3; n++) {
        const [name, category] = sample[(n + page * 3) % sample.length];
        if (!choices.some(c => c.name.toLowerCase() === name.toLowerCase()))
            choices.push({ name, category, reason: 'A general activity idea to compare. Venue, cost and availability have not been researched.' });
    }
    if (sampleId === 'straightforward' && page === 0) {
        choices = choices.slice(0, 2);
        choices.push({ name: 'Mini-golf · sample quote', category: 'any', reason: 'Synthetic $25/person total to demonstrate the group’s firm spending checks.' });
    }
    return choices.map((c, i) => ({ art: c.category, reason: c.reason, candidate: { name: c.name, category: c.category, sourceUrl: null, address: null, lat: null, lon: null, price: { amount: sampleId === 'straightforward' && page === 0 && i === 2 ? 25 : null, currency: sampleId === 'straightforward' && page === 0 && i === 2 ? 'USD' : null, basis: 'per-person', coverage: sampleId === 'straightforward' && page === 0 && i === 2 ? 'total' : 'unknown' }, hours: { ...unknownHours } } }));
}
