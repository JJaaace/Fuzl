import { cardFactText, commonWindow, current, moneyText } from '@fuzl/planning';
import type { PlanningFact, PlanningSummary } from '@fuzl/planning';

// Display-only shortening. Canonical facts and original excerpts stay intact.
export function activityHeading(fact: PlanningFact | undefined) {
  if (!fact || fact.kind !== 'activity' || !fact.description?.trim()) return 'Choose an activity together';
  const name = fact.description.split(/\s+[—–]\s+(?:idea only|proposed)/i)[0];
  return fact.status === 'proposed' ? `${name} suggested` : `${name} · ${fact.status}`;
}
export function availabilityHeading(summary: PlanningSummary) {
  const window = commonWindow(summary);
  if(window.conflict||window.label.includes('Multiple availability windows')||window.label==='Confirmed availability does not overlap')return window.label;
  if (window.date) return `${window.date} · ${window.start}–${window.end} · confirmed availability`;
  const schedules=summary.facts.filter(f=>current(f)&&f.kind==='schedule');
  const first=schedules[0];
  if(first?.kind!=='schedule')return 'Date and time to decide';
  if(first.exactDate)return `${first.exactDate}${first.startTime?` · ${first.startTime}${first.endTime?`–${first.endTime}`:''}`:''} · availability to confirm`;
  const description=first.description?.split(';')[0].replace(/^This\s+/i,'').replace(/^Maybe\s+/i,'') || 'Availability to review';
  const status=schedules.some(f=>f.status==='conflicting')?'conflicting':schedules.some(f=>f.status!=='confirmed')?'tentative':'date unresolved';
  return `${description} · ${status}`;
}
export function compactFactText(fact: PlanningFact) {
  if (fact.kind==='budget' && fact.amount!==null && fact.currency===null) return `${fact.amount}/person · confirm currency`;
  if (fact.kind==='budget') return moneyText(fact.amount,fact.currency,true);
  if (fact.kind==='schedule') {
    const description=fact.description?.split(';')[0] || fact.exactDate || 'Availability unknown';
    if(fact.startTime)return `${fact.exactDate??description} · ${fact.startTime}${fact.endTime?`–${fact.endTime}`:' · end unknown'}`;
    return `${description}${/AM\/PM/i.test(fact.description??'')?' · AM/PM unclear':fact.exactDate?' · time unknown':''}`;
  }
  return cardFactText(fact);
}
export function overviewQuestion(summary: PlanningSummary) {
  const conflict=summary.questions.find(q=>q.resolution===null&&q.kind==='conflict');
  if(conflict)return {id:conflict.id,text:conflict.text};
  if(commonWindow(summary).conflict)return {id:undefined,text:'Confirmed availability does not overlap. Review the time windows.'};
  const date=summary.facts.find(f=>current(f)&&f.kind==='schedule'&&f.exactDate===null);
  const issue=summary.questions.find(q=>q.resolution===null && (date?q.relatedFactIds.includes(date.id):true)) ?? summary.questions.find(q=>q.resolution===null);
  if(date?.kind==='schedule' && !summary.facts.some(f=>current(f)&&f.status==='conflicting')) {
    const weekday=/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.exec(date.description??'')?.[1];
    return {id:issue?.id,text:weekday?`Which ${weekday} works for everyone?`:'Which date works for everyone?'};
  }
  return {id:issue?.id,text:issue?.text??'No open questions recorded'};
}
