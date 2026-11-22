import { savedSummarySchema, summaryReferencesValid, supportingSummary } from '@fuzl/planning';
import type { PlanningSummary } from '@fuzl/planning';
import { ExtractionError } from '../extraction/errors.js';
const union=<T extends {id:string}>(a:T[],b:T[])=>[...a.filter(item=>!b.some(next=>next.id===item.id)),...b];
export function mergeNativeSummary(previous:PlanningSummary,incoming:PlanningSummary):PlanningSummary{
  const old=previous.facts.map(f=>{
    // Only previous native-derived facts are superseded. Imported/private and
    // organizer-entered constraints remain until their existing editor changes them.
    if(!f.id.startsWith('cf-')||!incoming.facts.some(n=>n.kind===f.kind&&JSON.stringify(n.subject)===JSON.stringify(f.subject)))return f;
    return {...f,extraction:{reviewed:f.extraction?.reviewed??false,reportedStatus:f.extraction?.reportedStatus??f.status,uncertainty:'Earlier native fact; replaced by an explicitly approved thread update.',supersedes:[],scope:'historical' as const}};
  });
  const value={...previous,participants:union(previous.participants,incoming.participants),speakers:union(previous.speakers,incoming.speakers),sources:union(previous.sources,incoming.sources),facts:union(old,incoming.facts),questions:union(previous.questions,incoming.questions)};
  const parsed=savedSummarySchema.safeParse(value);
  if(!parsed.success||!summaryReferencesValid(value))throw new ExtractionError(422,'chat_summary_limit','This merge exceeds the existing summary limits or needs attribution review. Open the full Plan editor to resolve it; previous work was kept.');
  return supportingSummary(parsed.data);
}
export function removeNativeSources(summary:PlanningSummary,ids:string[]):PlanningSummary{
  const removed=new Set(ids),facts=summary.facts.filter(f=>!f.sourceIds.some(id=>removed.has(id))),remaining=new Set(facts.map(f=>f.id));
  return supportingSummary({...summary,sources:summary.sources.filter(s=>!removed.has(s.id)),facts:facts.map(f=>f.extraction?{...f,extraction:{...f.extraction,supersedes:f.extraction.supersedes.filter(id=>remaining.has(id))}}:f),questions:summary.questions.map(q=>({...q,relatedFactIds:q.relatedFactIds.filter(id=>remaining.has(id))}))});
}
