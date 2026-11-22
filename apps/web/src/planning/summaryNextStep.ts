import { commonWindow, proposalWindow } from '@fuzl/planning';
import type { PlanningSummary } from './model';

export type SummaryNextStep =
  | { kind: 'fact'; id: string; field?: 'date'; label: string; hint: string }
  | { kind: 'question'; id: string; label: string; hint: string }
  | { kind: 'add'; factKind: 'schedule' | 'activity'; label: string; hint: string }
  | { kind: 'tools'; label: string; hint: string }
  | { kind: 'save'; label: string; hint: string };

// Navigation only: this never changes facts, resolves questions or infers dates.
export function summaryNextStep(summary: PlanningSummary): SummaryNextStep {
  const facts = summary.facts.filter(fact => fact.extraction?.scope !== 'historical');
  const conflict = facts.find(fact => fact.status === 'conflicting');
  if (conflict) {
    const question = summary.questions.find(question => question.resolution === null && question.relatedFactIds.includes(conflict.id));
    return question
      ? { kind: 'question', id: question.id, label: 'Review the conflict', hint: 'No compromise is assumed. Related facts stay unchanged.' }
      : { kind: 'fact', id: conflict.id, label: 'Review the conflict', hint: 'Keep firm requirements in view before choosing an option.' };
  }
  const openConflict = summary.questions.find(question => question.kind === 'conflict' && question.resolution === null);
  if (openConflict) return { kind: 'question', id: openConflict.id, label: 'Review the conflict', hint: 'No compromise is assumed. Related facts stay unchanged.' };
  if(commonWindow(summary).conflict){
    const timing=facts.find(fact=>fact.kind==='schedule');
    if(timing)return {kind:'fact',id:timing.id,label:'Review availability',hint:'Confirmed firm availability does not overlap. Review the existing windows; no adjustment is assumed.'};
  }
  const proposedWindow=proposalWindow(summary);
  if(proposedWindow.conflict){const timing=facts.find(f=>f.kind==='schedule');if(timing)return {kind:'fact',id:timing.id,label:'Review availability',hint:proposedWindow.label};}
  if(facts.length&&!facts.some(f=>f.kind==='schedule'))return {kind:'add',factKind:'schedule',label:'Add availability',hint:'Date and time are unknown. Add only what you know.'};
  if(proposedWindow.date&&!facts.some(f=>f.kind==='activity'&&f.description?.trim())){
    const empty=facts.find(f=>f.kind==='activity');
    return empty?{kind:'fact',id:empty.id,label:'Review the activity',hint:'The activity is unknown. Enter an idea only when known.'}:{kind:'add',factKind:'activity',label:'Add an activity idea',hint:'Enter an idea or an organizer candidate before choosing a proposal.'};
  }
  if(proposedWindow.date&&facts.some(fact=>fact.extraction&&!fact.extraction.reviewed))return {kind:'tools',label:'Plan with these facts',hint:'Uses the applied, source-linked facts. People cards are available for corrections; AI claims stay unreviewed.'};
  const date = facts.find(fact => fact.kind === 'schedule' && fact.exactDate === null);
  if (date) return { kind: 'fact', id: date.id, field: 'date', label: 'Review the date', hint: 'Choose a date only if you know it. Blank stays unknown.' };
  const timing = facts.find(fact => fact.kind === 'schedule' && (fact.status === 'tentative' || fact.startTime === null || fact.endTime === null));
  if (timing) return { kind: 'fact', id: timing.id, label: 'Review availability', hint: 'Tentative availability is not a confirmation.' };
  const claim = facts.find(fact => fact.extraction && !fact.extraction.reviewed);
  if (claim) return {kind:'tools',label:'Plan with these facts',hint:'Inspect People cards if needed. Planning tools explain any specific missing detail; claims remain unreviewed.'};
  const question = summary.questions.find(question => question.resolution === null);
  if (question) return { kind: 'question', id: question.id, label: 'Review an open question', hint: 'Record an answer when known; update related facts separately.' };
  if (!facts.length) return { kind: 'add', factKind: 'schedule', label: 'Add planning details', hint: 'Start with a date or availability. Unknown fields can stay blank.' };
  if (!facts.some(fact => fact.kind === 'schedule')) return { kind: 'add', factKind: 'schedule', label: 'Add availability', hint: 'Date and time are unknown. Add only what you know.' };
  if (!facts.some(fact => fact.kind === 'activity')) return { kind: 'add', factKind: 'activity', label: 'Add an activity idea', hint: 'An idea can stay proposed. No booking is assumed.' };
  const activity = facts.find(fact => fact.kind === 'activity' && !fact.description?.trim());
  if (activity) return { kind: 'fact', id: activity.id, label: 'Review the activity', hint: 'The activity is unknown. Enter an idea only when known.' };
  const budget = facts.find(fact => fact.kind === 'budget' && (fact.amount === null || fact.currency === null));
  if (budget) return { kind: 'fact', id: budget.id, label: 'Review the budget', hint: 'An unknown amount is not zero.' };
  return { kind: 'save', label: 'Review save options', hint: 'Saving is explicit. Nothing here establishes a booking.' };
}
