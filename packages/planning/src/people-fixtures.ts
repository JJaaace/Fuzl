import type { PlanningSummary } from './model.js';
import type { PlanProposalRequest } from './plan-proposals.js';
import { unknownHours } from './places.js';
// Manually authored synthetic outing. No provider request or stored user data.
export function peopleFixture(count: 2 | 6 = 6): { summary: PlanningSummary; manual: PlanProposalRequest['manual'] } {
  const names = ['Alex','Sam','Jordan','Maya','Ren','Pat'].slice(0,count);
  const summary: PlanningSummary = {participants:[],speakers:[],sources:[],facts:[],questions:[]};
  names.forEach((name,i)=>{
    const id=`p${i}`, speakerId=`s${i}`, sourceId=`q${i}`, amount=i===1?20:25;
    summary.participants.push({id,name});summary.speakers.push({id:speakerId,label:name,participantId:id});
    summary.sources.push({id:sourceId,speakerId,text:`${name}: April 18, 2099, 18:00–20:00 works. My firm limit is USD ${amount} per person and at most 20 minutes driving. Bowling is an unbooked idea.`});
    const meta={subject:{kind:'participant' as const,participantId:id},status:'confirmed' as const,strength:'firm' as const,sourceIds:[sourceId]};
    summary.facts.push({...meta,id:`date-${i}`,kind:'schedule',description:'Confirmed evening availability',exactDate:'2099-04-18',startTime:'18:00',endTime:'20:00'}, {...meta,id:`budget-${i}`,kind:'budget',amount,currency:'USD'}, {...meta,id:`travel-${i}`,kind:'travel',maxMinutes:20,comparison:'at-most',mode:'Driving'});
  });
  summary.facts.push({id:'idea',kind:'activity',description:'Bowling — proposed, not booked',subject:{kind:'group'},status:'proposed',strength:'flexible',sourceIds:['q0']});
  return {summary,manual:[{name:'Synthetic bowling option',sourceUrl:null,address:null,category:'bowling',lat:null,lon:null,price:{amount:25,currency:'USD',basis:'per-person',coverage:'total'},hours:{...unknownHours}}]};
}
