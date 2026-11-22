import { examples,emptySummary,answerRecordedPlan,assessIdeaOptions,manualPlaces,ideaChoices,supportingSummary } from '@fuzl/planning';
import type { ChatThread,ChatMessage,ChatRequest,ChatRequestInput,ChatPlan,PlanningSummary,SavedSession } from '@fuzl/planning';
import type { ChatClient } from './client';
import { ChatFailure } from './client';
import { ballotDemo } from '../ballots/demo';
import { planDemo } from '../plans/demo';
export const demoThreadId='a1111111-1111-4111-8111-111111111111',groupId='b1111111-1111-4111-8111-111111111111',sessionId='c1111111-1111-4111-8111-111111111111';
const ids=['d1111111-1111-4111-8111-111111111111','d2222222-2222-4222-8222-222222222222','d3333333-3333-4333-8333-333333333333'];
export function conversationDemo(delay=450){
  let version=1,contentVersion=1,sharedVersion=0,title='Friday night',sequence=0,shared=emptySummary(),offline=false,mode:'success'|'fast'|'error'='success',voteToken:string|null=null,planToken:string|null=null;
  const ballots=ballotDemo(token=>{voteToken=token;notify();}),plans=planDemo(()=>ballots.owner('','GET'),token=>{planToken=token;notify();});
  const messages:ChatMessage[]=examples[1].summary.sources.map(source=>({id:crypto.randomUUID(),submissionId:crypto.randomUUID(),memberId:ids[Number(source.speakerId.slice(1))],author:examples[1].summary.participants[Number(source.speakerId.slice(1))].name!,kind:'person',sequence:++sequence,changeVersion:version,text:source.text.replace(/^\w+:\s*/,''),createdAt:new Date(Date.now()-(5-sequence)*60000).toISOString(),deleted:false,requestId:null}));
  const requests:ChatRequest[]=[],watchers=new Set<(version:number)=>void>(),listeners=new Set<()=>void>();
  const members=ids.map((id,i)=>({id,name:['Alex','Sam','Jordan'][i],role:i===0?'organizer' as const:'member' as const,identity:i===0?'account' as const:'guest' as const,active:true,canAI:i===0,planningParticipantId:null}));
  function notify(){for(const callback of watchers)callback(version);for(const listener of listeners)listener();}
  const session=():SavedSession=>({id:sessionId,groupId,title,revision:sharedVersion+1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),payload:{title,summaryVersion:1,origin:'sample',summary:supportingSummary(shared),provenance:[]}});
  function authored():{plan:ChatPlan;sourceMessages:Record<string,string>}{
    const summary=structuredClone(examples[1].summary),sourceMessages:Record<string,string>={};
    summary.participants=members.map(m=>({id:m.id,name:m.name}));summary.speakers=members.map((m,i)=>({id:`s${i}`,label:m.name,participantId:m.id}));
    for(const source of summary.sources){const found=messages.find(m=>m.author===summary.speakers.find(s=>s.id===source.speakerId)?.label&&m.text===source.text.replace(/^\w+:\s*/,''));if(found)sourceMessages[source.id]=found.id;}
    const change=messages.find(m=>m.text==='I may only be free after 8 PM; the exact Friday is still unknown.');
    if(change){const timing=summary.facts.find(f=>f.id==='b-time');if(timing?.kind==='schedule'){timing.description='Maybe after 8 PM; exact Friday unknown';timing.sourceIds=['demo-later-time'];}summary.sources.push({id:'demo-later-time',speakerId:'s1',text:`Sam: ${change.text}`});sourceMessages['demo-later-time']=change.id;}
    summary.facts=summary.facts.filter(f=>f.sourceIds.length>0).map(f=>({...f,status:f.status==='confirmed'?'proposed':f.status,extraction:{reviewed:false,reportedStatus:f.status,scope:'current',uncertainty:'Manually authored demo claim; no AI analysis ran.',supersedes:[]}}));summary.questions=summary.questions.map(q=>({...q,relatedFactIds:q.relatedFactIds.filter(id=>summary.facts.some(f=>f.id===id))}));
    return{plan:{summary,suggestions:assessIdeaOptions(manualPlaces(ideaChoices(summary,undefined,0).map(i=>i.candidate),new Date().toISOString()),summary),followUp:'Which Friday works, and can Sam confirm the time?',usedMessages:messages.filter(m=>m.kind==='person'&&!m.deleted).length},sourceMessages};
  }
  const thread=(actor:number):ChatThread=>({id:demoThreadId,groupId,groupName:'Alex, Sam & Jordan · fixture',sessionId,title,version,contentVersion,sharedVersion,sharedSummary:shared,me:members[actor],members,requests:[...requests].reverse().map(r=>r.state==='ready'&&(r.contentVersion!==contentVersion||r.sharedVersion!==sharedVersion)?{...r,state:'stale',message:'The fixture discussion changed. Review a new proposal.'}:r)});
  const client=(actor:number):ChatClient=>({groups:async()=>actor===0?[{id:groupId,name:'Alex, Sam & Jordan · fixture',aliases:[],revision:1,sessionCount:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]:[],session:async()=>{if(actor!==0)throw new ChatFailure('Only the fixture organizer can open its session.',403);return session();},
    async call<T>(path:string,method='GET',raw?:unknown,signal?:AbortSignal){
      if(offline)throw new ChatFailure('Simulated connection interruption. Your draft is kept.',503);if(!members[actor].active)throw new ChatFailure('Simulated chat access revoked.',403);
      const url=new URL(path,'https://fixture.invalid'),parts=url.pathname.split('/').filter(Boolean),body=raw as Record<string,unknown>;
      if(parts[0]==='demo-ballots')return await ballots.owner(parts.length>1?'/'+parts.slice(1).join('/'):'',method,raw) as T;
      if(path==='/threads'&&method==='GET')return [{id:demoThreadId,title,groupId,groupName:'Alex, Sam & Jordan · fixture',sessionId}] as T;
      if(path==='/threads'&&method==='POST'){if(actor!==0)throw new ChatFailure('Organizer only',403);title=String(body.title);version++;notify();return thread(actor) as T;}
      if(parts[2]==='review'){if(actor!==0)throw new ChatFailure('Organizer only',403);const result:ChatRequest={id:crypto.randomUUID(),memberId:ids[actor],kind:'plan',state:'ready',contentVersion,sharedVersion,plan:{summary:structuredClone(shared),suggestions:[],followUp:'Review shared corrections; no AI request.',usedMessages:0},answer:null,sourceMessages:authored().sourceMessages,message:'Organizer correction preview · no AI request.',createdAt:new Date().toISOString()};requests.push(result);version++;notify();return structuredClone(result) as T;}
      if(parts[2]==='requests'){
        const request=requests.find(r=>r.id===parts[3]);
        if(parts[4]==='cancel'){if(request&&request.memberId===ids[actor])request.state='cancelled';version++;notify();return{ok:true} as T;}
        if(parts[4]==='apply'){if(actor!==0||!request||request.state!=='ready'||request.contentVersion!==contentVersion||request.sharedVersion!==sharedVersion)throw new ChatFailure('The proposal is stale or this identity cannot apply it.',409);shared=structuredClone(body.summary) as PlanningSummary;sharedVersion++;contentVersion++;version++;request.state='applied';notify();return{sessionId,revision:sharedVersion+1} as T;}
        const input=body as unknown as ChatRequestInput,old=requests.find(r=>r.id===input.requestId);if(old)return structuredClone(old) as T;if(input.contentVersion!==contentVersion||input.sharedVersion!==sharedVersion)throw new ChatFailure('The conversation changed. Refresh and ask again.',409);if(input.kind==='plan'&&actor!==0)throw new ChatFailure('The fixture organizer controls planning.',403);
        const result:ChatRequest={id:input.requestId,memberId:ids[actor],kind:input.kind,state:'pending',contentVersion,sharedVersion,plan:null,answer:null,sourceMessages:{},message:'Simulated request in progress.',createdAt:new Date().toISOString()};requests.push(result);version++;notify();
        if(input.kind==='plan'){await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,mode==='fast'?0:delay);signal?.addEventListener('abort',()=>{clearTimeout(timer);result.state='cancelled';version++;notify();reject(new DOMException('Cancelled','AbortError'));},{once:true});});if(mode==='error'){result.state='failed';version++;notify();throw new ChatFailure('Simulated Gemini failure. No provider was called; your plan was kept.',503);}const fixture=authored();result.plan=fixture.plan;result.sourceMessages=fixture.sourceMessages;}
        else{result.answer=answerRecordedPlan(shared,input.question??'',input.participantId);result.sourceMessages=authored().sourceMessages;}
        result.state=input.contentVersion===contentVersion&&input.sharedVersion===sharedVersion?'ready':'stale';result.message='Simulated Fuzl response · hand-authored fixture, not live analysis.';version++;messages.push({id:crypto.randomUUID(),submissionId:crypto.randomUUID(),memberId:null,author:'Fuzl',kind:'fuzl',sequence:++sequence,changeVersion:version,text:result.message,createdAt:new Date().toISOString(),deleted:false,requestId:result.id});notify();return structuredClone(result) as T;
      }
      if(parts[2]==='messages'){
        if(method==='POST'){const old=messages.find(m=>m.memberId===ids[actor]&&m.submissionId===body.submissionId);if(old)return structuredClone(old) as T;version++;contentVersion++;const message:ChatMessage={id:crypto.randomUUID(),submissionId:String(body.submissionId),memberId:ids[actor],author:members[actor].name,kind:'person',sequence:++sequence,changeVersion:version,text:String(body.text),createdAt:new Date().toISOString(),deleted:false,requestId:null};messages.push(message);notify();return structuredClone(message) as T;}
        const message=messages.find(m=>m.id===parts[3]);if(method==='DELETE'){if(!message||message.memberId!==ids[actor]&&actor!==0)throw new ChatFailure('Cannot remove another participant’s message.',403);version++;contentVersion++;message.text=null;message.deleted=true;message.changeVersion=version;for(const r of requests){r.state='stale';r.plan=null;r.answer=null;}notify();return{ok:true} as T;}
        if(parts[3]){if(!message)throw new ChatFailure('Source unavailable',404);return structuredClone(message) as T;}
        const changes=url.searchParams.get('changesAfter'),before=url.searchParams.get('before'),all=messages.filter(m=>changes!==null?m.changeVersion>Number(changes):before?m.sequence<Number(before):true),page=changes!==null?all:all.slice(-50);return{messages:structuredClone(page),version,hasOlder:changes===null&&all.length>50,reset:false} as T;
      }
      if(parts[2]==='invites'&&method==='GET')return [] as T;
      if(parts[2]==='members'&&method==='PUT'){if(actor!==0)throw new ChatFailure('Organizer only',403);const member=members.find(m=>m.id===parts[3]);if(member)member.planningParticipantId=body.planningParticipantId as null;contentVersion++;version++;notify();return{ok:true} as T;}
      if(parts[2]==='invites'){if(actor!==0)throw new ChatFailure('Organizer only',403);return{id:String(body?.id??parts[3]),expiresAt:new Date(Date.now()+7*86400000).toISOString()} as T;}
      if(parts[2]==='members'&&method==='DELETE'){if(actor!==0&&parts[3]!==ids[actor])throw new ChatFailure('Organizer only',403);const member=members.find(m=>m.id===parts[3]);if(member)member.active=false;version++;contentVersion++;notify();return{ok:true} as T;}
      if(method==='PUT'){if(actor!==0)throw new ChatFailure('Organizer only',403);title=String(body.title);version++;notify();return{ok:true} as T;}
      return structuredClone(thread(actor)) as T;
    },
    async watch(_id,onVersion,onStatus,signal){const update=(v:number)=>{onStatus(members[actor].active?(offline?'reconnecting':'live'):'revoked');if(!offline)onVersion(v);};watchers.add(update);update(version);await new Promise<void>(resolve=>signal.addEventListener('abort',()=>{watchers.delete(update);resolve();},{once:true}));}
  });
  return{client,session,ballots,plans,get voteToken(){return voteToken;},get planToken(){return planToken;},setMode:(value:typeof mode)=>{mode=value;},offline:()=>{offline=!offline;notify();return offline;},availabilityChange:async()=>{await client(1).call(`/threads/${demoThreadId}/messages`,'POST',{submissionId:crypto.randomUUID(),text:'I may only be free after 8 PM; the exact Friday is still unknown.'});},subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};}};
}
