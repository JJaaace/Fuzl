import type { PlanningSummary } from './model.js';
import type { PlaceCandidate } from './places.js';
import { participationFixture } from './participation-fixtures.js';
import type { ParticipationScope } from './participation-contract.js';
import type { TravelContext, TravelHistory } from './travel-balance.js';
import { workKey } from './adjustments.js';
export function travelFixture(subset = false, variant: 'normal' | 'other-group' | 'corrected' | 'deleted' | 'missing' = 'normal') {
  const f=participationFixture(), summary:PlanningSummary={...f.summary,participants:f.summary.participants.slice(0,3),facts:f.summary.facts.filter(f=>f.subject.kind==='participant'&&['person-1','person-2','person-3'].includes(f.subject.participantId)).map(f=>f.kind==='budget'?{...f,amount:20}:f.kind==='travel'?{...f,maxMinutes:60}:f)};
  const scope: ParticipationScope={mode:subset?'available':'everyone',attendeeCount:subset?2:3,roster:summary.participants.map((p,i)=>({...p,availability:'confirmed',selected:!subset||i<2,evidence:'opt-in'})),window:f.window,expiresAt:'2026-11-15T02:00:00Z',reviewed:true,key:(subset?'b':'a').repeat(64)};
  const candidates:PlaceCandidate[]=[{...f.candidate,id:'a-usual',name:'Synthetic central garden',price:{...f.candidate.price,amount:12}},{...f.candidate,id:'b-balanced',sourceUrl:'https://example.com/synthetic-east-garden',name:'Synthetic east garden',price:{...f.candidate.price,amount:12}},{...f.candidate,id:'c-budget',sourceUrl:'https://example.com/synthetic-budget-failure',name:'Synthetic over-budget garden',price:{...f.candidate.price,amount:99}},{...f.candidate,id:'d-unknown',sourceUrl:'https://example.com/synthetic-unknown-route',name:'Synthetic unknown travel',visit:{...f.candidate.visit,travel:undefined}}];
  const aliasIds=summary.participants.map((_,i)=>`00000000-0000-4000-8000-00000000010${i}`);
  const history=(values:number[]):TravelHistory=>({mode:'walking',basis:'one-way',reviewed:true,attendees:aliasIds.map((aliasId,i)=>({aliasId,attended:true,minutes:values[i]}))});
  const outings=variant==='other-group'?[]:[{date:'2026-11-01',history:history(variant==='corrected'?[40,40,40]:[50,20,120])},...(variant==='deleted'?[]:[{date:'2026-11-07',history:history(variant==='corrected'?[40,40,40]:[50,20,120])}])];
  const travel:TravelContext={scope,now:Date.parse('2026-11-14T22:00:00Z'),outings,setup:{mode:'walking',basis:'one-way',reviewed:true,mappings:summary.participants.map((p,i)=>({participantId:p.id,aliasId:aliasIds[i]})),estimates:candidates.slice(0,3).map((c,i)=>({key:workKey(c),address:c.address!,window:f.window,checkedOn:'2026-11-14',sourceUrl:'https://example.com/synthetic-private-minutes',minutes:summary.participants.map((p,j)=>({participantId:p.id,minutes:variant==='missing'?null:([[10,20,40],[30,10,5],[10,10,0]][i][j])}))}))}};
  return {...f,summary,scope,candidates,travel};
}
