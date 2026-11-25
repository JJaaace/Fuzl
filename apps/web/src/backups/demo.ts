import { newRecordId } from '@fuzl/planning';
import { assessBackup, backupFixture, backupPublicDetails, backupPreviewInputSchema, backupSaveSchema, backupSwitchSchema, detailsFromOption, planOwnerSchema, backupRecordSchema } from '@fuzl/planning';
import type { PlanBackup, BackupPreview, OwnerPlan } from '@fuzl/planning';
import { ballotDemo } from '../ballots/demo';
import { planDemo } from '../plans/demo';
export function backupDemo() {
  const f=backupFixture(),ballots=ballotDemo(()=>{});let token='';const plans=planDemo(()=>ballots.owner('','GET'),v=>{token=v;});let backup:PlanBackup|null=null,scope=f.scope;
  const records=new Map<string,{key:string;result:unknown}>();
  const digest=async(v:unknown)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v))))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const ready=(async()=>{await ballots.owner('/shortlist','PUT',{revision:0,sessionRevision:1,content:{title:'Synthetic outdoor / indoor choices',options:[f.outdoor,f.indoor]}});const b=await ballots.owner('/publish','POST',{publicationId:newRecordId(),inviteToken:'b'.repeat(43),expectedBallotId:null,shortlistRevision:1,sessionRevision:1,approved:true,days:14}) as {ballot:{id:string}};let p=planOwnerSchema.parse(await plans.owner('/select','POST',{requestId:newRecordId(),revision:0,sessionRevision:1,ballotId:b.ballot.id,optionId:f.outdoor.id}));p=planOwnerSchema.parse(await plans.owner('/draft','PUT',{requestId:newRecordId(),revision:p.revision,details:{...detailsFromOption(f.outdoor),date:f.details.date,time:'19:00',timeZone:f.details.timeZone}}));p=planOwnerSchema.parse(await plans.owner('/publish','POST',{requestId:newRecordId(),revision:p.revision,previewKey:p.draftKey,approved:true,notice:'Synthetic original outdoor outing'}));await plans.owner('/link','POST',{requestId:newRecordId(),revision:p.revision,token:'p'.repeat(43),days:14,replace:false});})();
  const checked=()=>{if(!backup)throw Error('Set a private backup first.');return assessBackup(backup,f.summary,scope,[],Date.parse('2026-11-14T22:00:00Z'));};
  const preview=async(p:OwnerPlan,input:ReturnType<typeof backupPreviewInputSchema.parse>):Promise<BackupPreview>=>{
    if(!backup||backup.usedAtVersion||p.revision!==input.revision||backup.revision!==input.backupRevision||!scope.reviewed)throw Error('Demo plan, backup or attendee scope changed. Reload and preview again.');const assessment=checked(),replacement={ballotId:p.draft.ballotId,option:backup.option,details:backupPublicDetails(backup,assessment),replacement:{kind:'backup' as const,backupId:backup.id,backupRevision:backup.revision,fromVersion:p.published!.version,origin:backup.origin},scopeProof:{scopeKey:scope.key,rosterKey:await digest(scope)}};
    const notice=`Switched to the prepared backup. ${input.notice}`;return{previewKey:await digest([p.revision,backup,scope,replacement,assessment.checks,notice]),revision:p.revision,sessionRevision:1,backupRevision:backup.revision,current:p.published!,replacement,assessment,notice};
  };
  const request=async(path:string,method:string,raw?:unknown):Promise<unknown>=>{await ready;const p=planOwnerSchema.parse(await plans.owner('','GET'));
    if(method==='GET')return{backup:structuredClone(backup),assessment:backup?checked():null};
    if(path==='/preview')return preview(p,backupPreviewInputSchema.parse(raw));
    const input=raw as {requestId:string};const key=JSON.stringify([path,raw]),old=records.get(input.requestId);if(old){if(old.key!==key)throw Error('Demo retry changed.');return structuredClone(old.result);}
    let result;
    if(path==='/switch'){const input=backupSwitchSchema.parse(raw),v=await preview(p,input);if(v.previewKey!==input.previewKey)throw Error('Demo preview changed. Preview again.');if(v.assessment.status==='does-not-fit')throw Error('Known firm conflict. Resolve it before switching.');result=await plans.replace(v.replacement,v.notice,p.revision);backup={...backup!,usedAtVersion:(result as OwnerPlan).published!.version};}
    else{const input=backupSaveSchema.parse(raw);if(input.revision!==p.revision||input.backupRevision!==(backup?.revision??0))throw Error('Demo revision changed.');const option=input.source.kind==='shortlist'?[f.outdoor,f.indoor].find(o=>o.id===(input.source as {optionId:string}).optionId):{...f.indoor,id:backup?.id??newRecordId(),name:input.details.activity,location:input.details.meetingPoint,cost:input.details.cost,links:input.details.links,unresolved:[]};if(!option)throw Error('Unknown saved shortlist option');backup=backupRecordSchema.parse({id:backup?.id??newRecordId(),revision:(backup?.revision??0)+1,usedAtVersion:null,origin:input.source.kind,shortlistRevision:input.source.kind==='shortlist'?input.source.shortlistRevision:null,option,details:input.details,endTime:input.endTime,availabilityTimeZone:input.availabilityTimeZone,privateNote:input.privateNote});
      // Reuse the simulator's revision/CAS action without changing public fields.
      result=await plans.owner('/draft','PUT',{requestId:input.requestId,revision:p.revision,details:p.draft.details});}
    records.set(input.requestId,{key,result:structuredClone(result)});return result;
  };
  return {ready,request,plans,ballots,token:()=>token,changeScope:()=>{scope={...scope,key:'b'.repeat(64),reviewed:false};},restoreScope:()=>{scope=f.scope;}};
}
