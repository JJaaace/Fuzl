import { backupFixture } from './backup-fixtures.js';
import { detailsFromOption } from './plans.js';
import type { OwnerPlan, PlanDraft } from './plans.js';
import type { OwnerOuting, PastOuting } from './outings.js';
export function groupHistoryFixture() {
  const f=backupFixture(),stamp='2026-11-14T12:00:00.000Z';
  const groups=[{id:'00000000-0000-4000-8000-000000001701',name:'Synthetic Group A'},{id:'00000000-0000-4000-8000-000000001702',name:'Synthetic Group B'}];
  function record(index:number,group:number,name:string,date:string,backup:boolean,approved:string|null) {
    const id=`00000000-0000-4000-8000-0000000018${String(index).padStart(2,'0')}`,sessionId=`00000000-0000-4000-8000-0000000019${String(index).padStart(2,'0')}`,option={...(backup?f.indoor:f.outdoor),name};
    const outdoor={...detailsFromOption(f.outdoor),date,time:'19:00',timeZone:'America/New_York'},details={...detailsFromOption(option),date,time:backup?'19:00':'15:00',timeZone:'America/New_York'};
    const draft:PlanDraft={ballotId:'00000000-0000-4000-8000-000000001600',option,details,...(backup?{replacement:{kind:'backup' as const,backupId:'00000000-0000-4000-8000-000000001650',backupRevision:1,fromVersion:1,origin:'shortlist' as const}}:{})};
    const plan:OwnerPlan={id,revision:8,status:'completed',draftKey:'a'.repeat(64),draft,published:{id,version:3,materialVersion:2,status:'completed',details,sample:true,changeNotice:'Synthetic actual outing recorded; attendance stays separate.',publishedAt:stamp,rsvpOpen:false},history:[{version:3,status:'completed',materialVersion:2,changeNotice:'Actual outing recorded.',publishedAt:stamp,details,selectedName:name},...(backup?[{version:2,status:'confirmed' as const,materialVersion:2,changeNotice:'Switched from the outdoor picnic to the indoor backup.',publishedAt:stamp,details,selectedName:name},{version:1,status:'confirmed' as const,materialVersion:1,changeNotice:'Originally agreed outdoor picnic.',publishedAt:stamp,details:outdoor,selectedName:f.outdoor.name}]:[])],link:null,attendance:[],counts:{going:0,maybe:0,cant:0,needsReconfirmation:0,totalResponses:0}};
    const outing:OwnerOuting={id,sessionId,revision:1,actual:{activity:name,date,time:backup?'18:30':'15:00',timeZone:'America/New_York',meetingPoint:backup?'Synthetic community room west entrance':option.location},original:draft,originalVersion:backup?2:1,sameListing:true,confirmedAttendees:backup?['Synthetic Avery']:[],feedbackVersion:approved?1:0,feedback:approved?[{id:'00000000-0000-4000-8000-000000001660',answers:{alias:'PRIVATE feedback author',attended:true,again:'yes',worth:null,note:'PRIVATE individual observation',allowMemory:true},needsReview:false,revision:1,updatedAt:stamp}]:[],privateNotes:'PRIVATE organizer note',proposedTakeaway:'PRIVATE proposed takeaway',approvedTakeaway:approved,memoryActive:!!approved,createdAt:stamp};
    return{groupId:groups[group].id,plan,outing};
  }
  const records=[record(1,0,'Synthetic indoor games after the backup switch','2026-11-13',true,'The indoor room worked for games. Check parking next time.'),record(2,0,'Synthetic riverside walk','2026-11-10',false,null),record(3,1,'Synthetic Group B cafe visit','2026-11-12',false,'A quiet table worked for this outing.')];
  // These records deliberately have no actual outing and must never be recaps.
  const excluded=[{kind:'cancelled',name:'Synthetic cancelled concert'},{kind:'unused-backup',name:'Synthetic unused cinema backup'},{kind:'shortlist',name:'Synthetic unvisited bowling option'}];
  const recap=(row:typeof records[number]):PastOuting=>({id:row.outing.id,sessionId:row.outing.sessionId,actual:structuredClone(row.outing.actual),memoryActive:row.outing.memoryActive,approvedTakeaway:row.outing.memoryActive?row.outing.approvedTakeaway:null,organizerAttendanceCount:row.outing.confirmedAttendees.length});
  return{groups,records,excluded,recap};
}
