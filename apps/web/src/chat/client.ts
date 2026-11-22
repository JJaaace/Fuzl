import type { SavedGroup,SavedSession } from '@fuzl/planning';
import { guestTokenSchema } from '@fuzl/planning';
import { privateRequest } from '../accounts/api';
export interface ThreadItem{id:string;title:string;groupId:string;groupName:string;sessionId:string}
export type Connection='connecting'|'live'|'reconnecting'|'disconnected'|'revoked';
export interface ChatClient{
  token?:string;
  call<T>(path:string,method?:string,body?:unknown,signal?:AbortSignal):Promise<T>;
  groups(signal:AbortSignal):Promise<SavedGroup[]>;
  session(id:string,signal:AbortSignal):Promise<SavedSession>;
  watch?(id:string,onVersion:(version:number)=>void,onStatus:(state:Connection)=>void,signal:AbortSignal):Promise<void>;
}
export class ChatFailure extends Error{constructor(message:string,readonly status:number,readonly reference?:string){super(message);}}
export function parseEvents(buffer:string){
  const blocks=buffer.split(/\r?\n\r?\n/),rest=blocks.pop()??'';
  const events=blocks.flatMap(block=>{
    const event=/^event: (\w+)$/m.exec(block)?.[1],data=/^data: (.+)$/m.exec(block)?.[1];
    if(!event||!data)return[];
    try{const value=JSON.parse(data) as {version?:unknown;code?:unknown};return event==='revoked'?[{event,version:0}]:event==='sync'&&typeof value.version==='number'&&Number.isSafeInteger(value.version)&&value.version>=0?[{event,version:value.version}]:[];}catch{return[];}
  });return{events,rest};
}
export function makeChatClient(token?:string,credential?:string,inviteToken?:string):ChatClient{
  const headers=()=>({'Content-Type':'application/json',...(credential?{'X-Chat-Credential':credential}:token?{Authorization:`Bearer ${token}`}:{})});
  async function call<T>(path:string,method='GET',body?:unknown,signal=new AbortController().signal):Promise<T>{
    const response=await fetch('/api/chat'+path,{method,headers:{...headers(),...(inviteToken?{'X-Chat-Invite':inviteToken}:{})},body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.any([signal,AbortSignal.timeout(path.endsWith('/requests')?55000:20000)])});
    const value=await response.json().catch(()=>{throw new ChatFailure('The conversation response could not be read. Your draft was kept.',response.status);});
    if(!response.ok)throw new ChatFailure(value?.error?.message??'Conversation access failed. Your draft was kept.',response.status,typeof value?.error?.reference==='string'?value.error.reference:undefined);return value as T;
  }
  const pause=(ms:number,signal:AbortSignal)=>new Promise<void>(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal.removeEventListener('abort',done);resolve();}signal.addEventListener('abort',done,{once:true});});
  return {token,call,groups:signal=>token?privateRequest<SavedGroup[]>(token,'/groups',signal):Promise.resolve([]),session:(id,signal)=>token?privateRequest<SavedSession>(token,`/sessions/${id}`,signal):Promise.reject(new ChatFailure('Only the organizer can open the private session.',403)),
    async watch(id,onVersion,onStatus,signal){
      let failures=0;
      while(!signal.aborted){
        if(typeof document!=='undefined'&&document.hidden){await pause(1000,signal);continue;}
        onStatus(failures?'reconnecting':'connecting');
        try{const response=await fetch(`/api/chat/threads/${id}/events`,{headers:headers(),signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
          if([401,403,404].includes(response.status)){onStatus('revoked');return;}if(!response.ok||!response.body)throw Error('Connection unavailable');onStatus('live');
          const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
          try{while(!signal.aborted){const next=await reader.read();if(next.done)break;buffer+=decoder.decode(next.value,{stream:true});if(buffer.length>16000)throw Error('Unsupported event frame');const parsed=parseEvents(buffer);buffer=parsed.rest;for(const event of parsed.events){if(event.event==='revoked'){onStatus('revoked');return;}onVersion(event.version);}}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
          failures=0;await pause(400,signal); // normal short lease: reverify identity on renewal
        }catch{if(signal.aborted)return;if(++failures>=4){onStatus('disconnected');return;}onStatus('reconnecting');await pause(Math.min(8000,1000*2**(failures-1)),signal);}
      }
    }};
}
export interface ChatCredential{threadId:string;memberId:string;joinId:string;credential:string}
const slot=(id:string)=>`fuzl-chat-member-${id}`;
export function writeChatCredential(value:ChatCredential,storage:Pick<Storage,'setItem'>=sessionStorage){storage.setItem(slot(value.threadId),JSON.stringify(value));}
export function readChatCredential(id:string,storage:Pick<Storage,'getItem'>=sessionStorage):ChatCredential|null{
  try{const value=JSON.parse(storage.getItem(slot(id))??'null') as ChatCredential|null;return value&&value.threadId===id&&guestTokenSchema.safeParse(value.credential).success&&typeof value.memberId==='string'&&typeof value.joinId==='string'?value:null;}catch{return null;}
}
export function clearChatCredentials(storage:Storage=sessionStorage){for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith('fuzl-chat-'))storage.removeItem(key);}}
