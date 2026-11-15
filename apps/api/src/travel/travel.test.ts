import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../app.js';
import { travelFixture } from '@fuzl/planning';
import { TravelStore } from './store.js';
import { ExtractionError } from '../extraction/errors.js';
test('private travel routes verify identity/ownership, reject malformed inputs and sanitize unexpected storage errors; public routes have no travel endpoint',async t=>{
  const owner=crypto.randomUUID(),session=crypto.randomUUID();let calls=0;
  const store=Object.create(TravelStore.prototype) as TravelStore;store.get=async(subject)=>{calls++;if(subject!==owner)throw new ExtractionError(404,'travel_unavailable','Unavailable');throw Error('PRIVATE synthetic connection string, history and password');};
  const app=createApp({accounts:{verify:async token=>token==='synthetic-owner-token'?owner:crypto.randomUUID(),travel:{store:()=>store}}}).listen(0,'127.0.0.1');await new Promise<void>(r=>app.once('listening',r));t.after(()=>new Promise<void>(r=>app.close(()=>r())));const url=`http://127.0.0.1:${(app.address() as import('node:net').AddressInfo).port}/api`,path=`/private/sessions/${session}/travel`;
  assert.equal((await fetch(url+path)).status,401);assert.equal(calls,0);
  assert.equal((await fetch(url+path,{headers:{Authorization:'Bearer synthetic-other-token'}})).status,404);
  const fail=await fetch(url+path,{headers:{Authorization:'Bearer synthetic-owner-token'}});assert.equal(fail.status,503);assert.ok(!(await fail.text()).includes('PRIVATE'));
  assert.equal((await fetch(url+path,{method:'PUT',headers:{Authorization:'Bearer synthetic-owner-token','Content-Type':'application/json'},body:JSON.stringify({setup:travelFixture().travel.setup})})).status,400);
  assert.equal((await fetch(url+path,{headers:{Authorization:'Bearer synthetic-owner-token',Origin:'https://wrong.example'}})).status,403);
  assert.equal((await fetch(url+'/guest/travel',{headers:{Authorization:'Bearer '+ 'g'.repeat(43)}})).status,404);
});
