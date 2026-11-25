import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newRecordId,guestTokenSchema} from '@fuzl/planning';
import {newEditPermission} from '../guests/api';
test('HTTP LAN UUID fallback uses secure random bytes and RFC v4/version bits with no Math.random fallback',()=>{
 let calls=0;const source={getRandomValues:(array:Uint8Array)=>{calls++;array.fill(255);return array;}} as Pick<Crypto,'getRandomValues'>;
 assert.equal(newRecordId(source),'ffffffff-ffff-4fff-bfff-ffffffffffff');assert.equal(calls,1);
 assert.throws(()=>newRecordId({} as Crypto),/secure identifiers/);
 const ids=new Set(Array.from({length:1000},()=>newRecordId({getRandomValues:crypto.getRandomValues.bind(crypto)})));
 assert.equal(ids.size,1000);assert.ok([...ids].every(id=>/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(id)));
});
test('supported native UUID method retains its receiver and guest credentials retain 256-bit token shape',()=>{
 const source={randomUUID(){assert.equal(this,source);return '11111111-1111-4111-8111-111111111111';},getRandomValues:()=>{throw Error('Unexpected fallback');}} as unknown as Crypto;
 assert.equal(newRecordId(source),'11111111-1111-4111-8111-111111111111');const permission=newEditPermission();assert.ok(guestTokenSchema.safeParse(permission.editToken).success);assert.equal(permission.editToken.length,43);
});
