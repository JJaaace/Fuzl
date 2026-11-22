import { GEMINI_MODEL, emptySummary, analysisResponseSchema } from '@fuzl/planning';
import type { AnalysisRequest, AnalysisResponse, PlanningFact } from '@fuzl/planning';
// Synthetic extractor for offline tests ONLY. Never wired into the production router.
export function authoredChatExtraction(input:AnalysisRequest):AnalysisResponse{
  const summary=emptySummary();
  for(const [i,line] of input.conversation.split('\n').entries()){
    if(!line.trim())continue;const label=line.slice(0,line.indexOf(':')),id=`p${i}`,speakerId=`s${i}`,sourceId=`q${i}`;
    summary.participants.push({id,name:label});summary.speakers.push({id:speakerId,label,participantId:id});summary.sources.push({id:sourceId,speakerId,text:line});
    const meta={subject:{kind:'speaker' as const,speakerId},sourceIds:[sourceId],strength:'firm' as const,status:'proposed' as const};
    const add=(value:PlanningFact)=>summary.facts.push({...value,extraction:{reviewed:false,reportedStatus:value.kind==='schedule'?'tentative':'confirmed',scope:'current',uncertainty:'Manually authored synthetic extraction, not a live provider result.',supersedes:[]}});
    const budget=/USD (\d+)/.exec(line);if(budget)add({...meta,id:`b${i}`,kind:'budget',amount:Number(budget[1]),currency:'USD'});
    if(/Friday|available|after 7|after 8/i.test(line))add({...meta,id:`t${i}`,kind:'schedule',status:'tentative',description:/after 8/.test(line)?'Maybe after 8':'Maybe Friday after 7; AM/PM unclear',exactDate:null,startTime:null,endTime:null});
    if(/20 minutes|20 min/.test(line))add({...meta,id:`r${i}`,kind:'travel',maxMinutes:20,comparison:/under|less than/i.test(line)?'under':'at-most',mode:'Driving'});
    if(/bowling/i.test(line))add({...meta,id:`a${i}`,kind:'activity',strength:'flexible',description:'Bowling — proposed, not booked'});
  }
  summary.questions.push({id:'date-question',kind:'missing',text:'Which Friday, and does 7 mean evening?',relatedFactIds:summary.facts.filter(f=>f.kind==='schedule').map(f=>f.id),resolution:null});
  const labelFor=(fact:PlanningFact)=>{const subject=fact.subject;return subject.kind==='speaker'?summary.speakers.find(s=>s.id===subject.speakerId)?.label:null;};
  for(const fact of summary.facts){const later=summary.facts.slice(summary.facts.indexOf(fact)+1).find(n=>n.kind===fact.kind&&labelFor(n)===labelFor(fact));if(later&&(fact.kind==='budget'||fact.kind==='schedule')&&fact.extraction){fact.extraction.scope='historical';later.extraction!.supersedes.push(fact.id);}}
  return analysisResponseSchema.parse({summary,warnings:[],metrics:{provider:'gemini',model:GEMINI_MODEL,latencyMs:1,inputTokens:null,outputTokens:null,estimatedCostUsd:null}});
}
