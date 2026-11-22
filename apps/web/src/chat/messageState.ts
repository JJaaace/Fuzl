import type { ChatMessage } from '@fuzl/planning';
export interface OutboxMessage {submissionId:string;memberId:string;text:string;author:string;createdAt:string;state:'sending'|'failed'}
export function reconcileMessages(previous:ChatMessage[],incoming:ChatMessage[]){
  const byId=new Map(previous.map(m=>[m.id,m]));for(const message of incoming){const old=byId.get(message.id);if(!old||message.changeVersion>=old.changeVersion)byId.set(message.id,message);}return [...byId.values()].sort((a,b)=>a.sequence-b.sequence);
}
export function remainingOutbox(outbox:OutboxMessage[],messages:ChatMessage[]){return outbox.filter(o=>!messages.some(m=>m.memberId===o.memberId&&m.submissionId===o.submissionId));}
export const nearConversationBottom=(height:number,top:number,viewport:number)=>height-top-viewport<90;
export const prependScrollTop=(oldTop:number,oldHeight:number,newHeight:number)=>oldTop+Math.max(0,newHeight-oldHeight);
