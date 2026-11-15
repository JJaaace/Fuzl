import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pastOutingsSchema, groupHistoryFixture } from '@fuzl/planning';
import { createApp } from '../app.js';
import { OutingStore } from './store.js';
import { ExtractionError } from '../extraction/errors.js';
test('group recap contract carries actual fields and active approved text only, never source/feedback/travel records',()=>{
  const f=groupHistoryFixture(),row=f.recap(f.records[0]);assert.ok(pastOutingsSchema.safeParse([row]).success);assert.equal(row.actual.activity,'Synthetic indoor games after the backup switch');assert.equal(row.organizerAttendanceCount,1);assert.equal(f.recap(f.records[1]).approvedTakeaway,null);
  for(const key of ['original','feedback','privateNotes','privateBudget','travelReview','confirmedAttendees'])assert.equal(pastOutingsSchema.safeParse([{...row,[key]:f.records[0].outing}]).success,false);
  assert.equal(pastOutingsSchema.safeParse([{...row,memoryActive:false}]).success,false);assert.equal(pastOutingsSchema.safeParse([{...row,organizerAttendanceCount:201}]).success,false);
});
test('existing recap route requires verified identity and group ownership, sanitizes failures and has no guest history counterpart',async t=>{
  const owner=crypto.randomUUID(),f=groupHistoryFixture();let calls=0;const store=Object.create(OutingStore.prototype)as OutingStore;store.past=async(subject,group)=>{calls++;if(subject!==owner)throw new ExtractionError(404,'outing_unavailable','Unavailable');if(group===f.groups[1].id)throw Error('PRIVATE connection string and feedback');return[f.recap(f.records[0])];};
  const app=createApp({outings:{store:()=>store},accounts:{verify:async token=>token==='synthetic-owner-token'?owner:crypto.randomUUID()}}).listen(0,'127.0.0.1');await new Promise<void>(r=>app.once('listening',r));t.after(()=>new Promise<void>(r=>app.close(()=>r())));const base=`http://127.0.0.1:${(app.address()as import('node:net').AddressInfo).port}/api`,path=`/private/groups/${f.groups[0].id}/outings`;
  assert.equal((await fetch(base+path)).status,401);assert.equal(calls,0);assert.equal((await fetch(base+path,{headers:{Authorization:'Bearer synthetic-other-token'}})).status,404);const ok=await fetch(base+path,{headers:{Authorization:'Bearer synthetic-owner-token'}});assert.equal(ok.status,200);assert.ok(!JSON.stringify(pastOutingsSchema.parse(await ok.json())).includes('PRIVATE'));
  const failure=await fetch(base+`/private/groups/${f.groups[1].id}/outings`,{headers:{Authorization:'Bearer synthetic-owner-token'}});assert.equal(failure.status,503);assert.ok(!(await failure.text()).includes('PRIVATE'));assert.equal((await fetch(base+path,{headers:{Authorization:'Bearer synthetic-owner-token',Origin:'https://wrong.example'}})).status,403);assert.equal((await fetch(base+'/plan/history',{headers:{Authorization:'Bearer '+'g'.repeat(43)}})).status,404);
});
