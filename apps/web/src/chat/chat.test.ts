import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEvents,readChatCredential,writeChatCredential } from './client';
import { reconcileMessages,remainingOutbox,nearConversationBottom,prependScrollTop } from './messageState';
import { aiBurst,aiSparkPose } from '../ui/aiSparks';
import type { ChatMessage } from '@fuzl/planning';
const message=(id:string,sequence:number,changeVersion=sequence):ChatMessage=>({id,submissionId:id,memberId:'member',author:'Sam',kind:'person',text:'Synthetic message',sequence,changeVersion,deleted:false,requestId:null,createdAt:'2026-11-21T12:00:00.000Z'});
test('native sync deduplicates, orders concurrent messages, applies tombstones and ignores out-of-order older records',()=>{
  const one=message('one',1),two=message('two',2),deleted={...one,changeVersion:4,text:null,deleted:true};
  const merged=reconcileMessages([two,one],[two,deleted]);assert.deepEqual(merged.map(m=>m.id),['one','two']);assert.equal(merged[0].text,null);assert.deepEqual(reconcileMessages(merged,[one]),merged);
  assert.equal(remainingOutbox([{submissionId:'two',memberId:'member',text:'retained',author:'Sam',state:'failed',createdAt:two.createdAt}],merged).length,0);
});
test('version-only SSE parsing supports partial frames and rejects unsupported metadata without reading message text',()=>{
  const first=parseEvents('event: sync\nid: 4\ndata: {"version":4}\n\nevent: sy');assert.deepEqual(first.events,[{event:'sync',version:4}]);assert.equal(first.rest,'event: sy');assert.equal(parseEvents('event: sync\ndata: {"version":"private"}\n\n').events.length,0);assert.equal(parseEvents('event: revoked\ndata: {"code":"chat_access_unavailable"}\n\n').events[0].event,'revoked');
});
test('only dedicated credentials persist; scroll math preserves older-history position and supports a near-bottom threshold',()=>{
  const values=new Map<string,string>(),storage={setItem:(k:string,v:string)=>values.set(k,v),getItem:(k:string)=>values.get(k)??null};const permission={threadId:'thread',memberId:'member',joinId:'join',credential:'a'.repeat(43)};writeChatCredential(permission,storage);assert.deepEqual(readChatCredential('thread',storage),permission);assert.equal(readChatCredential('other',storage),null);assert.ok(!JSON.stringify([...values]).includes('Synthetic message'));assert.equal(nearConversationBottom(1000,450,500),true);assert.equal(nearConversationBottom(1000,100,500),false);assert.equal(prependScrollTop(100,1000,1400),500);
});
test('AI completion has a bounded damped brand-color burst and settles without retaining dead particles',()=>{
  const sparks=aiBurst(100,200,0);assert.equal(sparks.length,24);assert.equal(aiBurst(100,200,0,true).length,12);assert.equal(new Set(sparks.map(s=>s.color)).size,3);for(const spark of sparks){assert.equal(aiSparkPose(spark,0).opacity,1);assert.equal(aiSparkPose(spark,2).alive,false);assert.ok(aiSparkPose(spark,.6).opacity<aiSparkPose(spark,.2).opacity);}
});
import {captureChatEntry} from './entry';

test('reopening a signed-in thread preserves its URL; invitation fragments are scrubbed before requests',()=>{
 const stored=new Map<string,string>(),storage={getItem:(k:string)=>stored.get(k)??null,setItem:(k:string,v:string)=>{stored.set(k,v);}};let replacements=0;
 const id='11111111-1111-4111-8111-111111111111';
 assert.equal(captureChatEntry(`https://beta.example/chat?thread=${id}`,()=>{replacements++;},storage),null);assert.equal(replacements,0);
 const token='a'.repeat(43);assert.equal(captureChatEntry(`https://beta.example/chat#invite=${token}`,path=>{replacements++;assert.equal(path,'/chat');},storage),token);
 assert.equal(replacements,1);assert.equal(stored.get('fuzl-chat-invite'),token);
});
