import type { PlanningSummary } from './model.js';
import type { PlanProposalRequest } from './plan-proposals.js';
import { unknownHours } from './places.js';
// Manually authored synthetic outing. No provider request or stored user data.
export function peopleFixture(count: number = 6): { summary: PlanningSummary; manual: PlanProposalRequest['manual'] } {
  if(!Number.isInteger(count)||count<1||count>20)throw new Error('Synthetic roster supports 1–20 people.');
  const names = ['Alex','Sam','Jordan','Maya','Ren','Pat','Morgan','Casey','Drew','Taylor','Avery','Rowan','Cameron','Jules','Robin','Lee','Remy','Quinn','Dakota','Sky'].slice(0,count);
  const summary: PlanningSummary = {participants:[],speakers:[],sources:[],facts:[],questions:[]};
  names.forEach((name,i)=>{
    const id=`p${i}`, speakerId=`s${i}`, sourceId=`q${i}`, amount=i===1?20:25;
    summary.participants.push({id,name});summary.speakers.push({id:speakerId,label:name,participantId:id});
    summary.sources.push({id:sourceId,speakerId,text:`${name}: April 18, 2099, 18:00–20:00 works. My firm limit is USD ${amount} per person and at most 20 minutes driving. Bowling is an unbooked idea.`});
    const meta={subject:{kind:'participant' as const,participantId:id},status:'confirmed' as const,strength:'firm' as const,sourceIds:[sourceId]};
    summary.facts.push({...meta,id:`date-${i}`,kind:'schedule',description:'Confirmed evening availability',exactDate:'2099-04-18',startTime:'18:00',endTime:'20:00'}, {...meta,id:`budget-${i}`,kind:'budget',amount,currency:'USD'}, {...meta,id:`travel-${i}`,kind:'travel',maxMinutes:20,comparison:'at-most',mode:'Driving'});
  });
  // Keep the 20-person fixture within the existing 60-fact contract.
  if(count===20){summary.facts=summary.facts.filter(f=>f.id!=='travel-19');summary.sources[19].text='Sky: April 18, 2099, 18:00–20:00 works. My firm limit is USD 25 per person. Travel limit not supplied.';}
  summary.facts.push({id:'idea',kind:'activity',description:'Bowling — proposed, not booked',subject:{kind:'group'},status:'proposed',strength:'flexible',sourceIds:['q0']});
  return {summary,manual:[{name:'Synthetic bowling option',sourceUrl:null,address:null,category:'bowling',lat:null,lon:null,price:{amount:25,currency:'USD',basis:'per-person',coverage:'total'},hours:{...unknownHours}}]};
}
