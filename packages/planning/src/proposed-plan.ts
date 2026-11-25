import { z } from 'zod';
import type { PlanningSummary } from './model.js';
const text=z.string().trim().min(1).max(600);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const parsed=new Date(value);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;});
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
// Generated decisions are separate from extracted facts and venue evidence.
export const proposedPlanSchema=z.strictObject({
 activity:text,activityType:text,date:date.nullable(),dateLabel:text,startTime:time.nullable(),endTime:time.nullable(),
 costPerPerson:z.number().nonnegative().max(1_000_000).nullable(),currency:z.string().regex(/^[A-Z]{3}$/).nullable(),
 travelNote:text,timingNote:text,why:text,backup:text,message:text,
 questions:z.array(text).max(15),assumptions:z.array(text).min(1).max(15),
});
export type ProposedPlan=z.infer<typeof proposedPlanSchema>;
export const outingProposalSchema=proposedPlanSchema.extend({questions:z.array(z.string().min(1).max(4000)).max(100),origin:z.enum(['ai','sample']),fit:z.enum(['needs-checking','does-not-fit']),checks:z.array(text).min(1).max(30)});
export type OutingProposal=z.infer<typeof outingProposalSchema>;
export function proposalKey(summary:PlanningSummary){return JSON.stringify(summary);}
export function planningBudget(summary:PlanningSummary){
 const budgets=summary.facts.filter(f=>f.kind==='budget'&&f.extraction?.scope!=='historical'&&f.status!=='conflicting');
 const known=budgets.filter(f=>f.kind==='budget'&&f.amount!==null);
 const currencies=[...new Set(known.map(f=>f.kind==='budget'?f.currency:null))];
 return {ceiling:known.length&&currencies.length===1?Math.min(...known.map(f=>f.kind==='budget'?f.amount!:Infinity)):null,currency:currencies.length===1?currencies[0]:null,comparable:currencies.length===1&&currencies[0]!==null};
}
export function planConflicts(plan:ProposedPlan,summary:PlanningSummary):string[]{
 const issues:string[]=[];const budget=planningBudget(summary);
 if(plan.costPerPerson!==null&&budget.ceiling!==null){
  if(budget.comparable&&plan.currency!==budget.currency)issues.push('The estimated currency does not match the stated budget.');
  else if(plan.currency===budget.currency&&plan.costPerPerson>budget.ceiling)issues.push('The estimate exceeds a stated spending limit.');
 }
 for(const f of summary.facts){if(f.extraction?.scope==='historical'||f.strength!=='firm'||f.status==='conflicting')continue;
  if(f.kind==='schedule'){
   if(f.exactDate&&plan.date&&f.exactDate!==plan.date)issues.push('The proposed date conflicts with firm availability.');
   if(f.startTime&&plan.startTime&&plan.startTime<f.startTime)issues.push('The proposed start is before firm availability.');
   if(f.endTime&&((plan.endTime&&plan.endTime>f.endTime)||(plan.startTime&&plan.startTime>=f.endTime)))issues.push('The proposed time exceeds firm availability.');
  }
 }
 if(plan.startTime&&plan.endTime&&plan.endTime<=plan.startTime)issues.push('The proposed time window is invalid.');
 return [...new Set(issues)];
}
