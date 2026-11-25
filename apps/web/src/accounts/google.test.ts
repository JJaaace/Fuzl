import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestGoogleSignIn, safeAuthDestination, takeAuthDestination } from './google';
import { captureMagicLink } from './magicLink';
const origin = 'https://fuzl-beta.example';
const thread = '11111111-1111-4111-8111-111111111111';
test('Google uses identity-only scopes and exact callback, preserving the invitation without persisting a draft', async () => {
  const values = new Map<string,string>(), moved: string[] = [];
  const storage = {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>{values.delete(key);}};
  const original = Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=> 'synthetic-invitation'}});
  const popup = {sessionStorage:storage,opener:{},location:{replace:(url:string)=>moved.push(url)},close:()=>assert.fail('valid request closed')} as unknown as Window;
  try {
    const result = await requestGoogleSignIn({signInWithOAuth:async input=>{
      assert.deepEqual(input,{provider:'google',options:{redirectTo:`${origin}/auth/callback`,scopes:'openid email profile',skipBrowserRedirect:true}});
      return {data:{provider:'google',url:'https://synthetic.supabase.co/auth/v1/authorize'},error:null};
    }},origin,origin,`${origin}/chat?thread=${thread}`,popup);
    assert.equal(result,''); assert.equal(popup.opener,null); assert.equal(moved.length,1);
    assert.equal(values.size,2); assert.equal(values.get('fuzl-chat-invite'),'synthetic-invitation');
    assert.equal(takeAuthDestination(storage),`/chat?thread=${thread}`); assert.equal(takeAuthDestination(storage),null);
  } finally { if(original)Object.defineProperty(globalThis,'sessionStorage',original);else Reflect.deleteProperty(globalThis,'sessionStorage'); }
});
test('OAuth callback removes credentials synchronously and only accepts its pending same-site destination', async () => {
  let path=''; let verified=0;
  const callback=captureMagicLink(`${origin}/auth/callback#access_token=synthetic-access&refresh_token=synthetic-refresh&provider_token=never-retain&token_type=bearer`,value=>{path=value;},origin,`/chat?thread=${thread}`);
  assert.equal(path,`/chat?thread=${thread}`); assert.equal(JSON.stringify(callback),'{}'); assert.ok(callback);
  const result=await callback.complete({setSession:async()=>{verified++;return {data:{session:{user:{aud:'authenticated',email:'synthetic@example.invalid',email_confirmed_at:'2026-11-24',is_anonymous:false}}},error:null};},signOut:async()=>({error:null})} as never);
  assert.equal(result.success,true);assert.equal(verified,1);
  const invalid=captureMagicLink(`${origin}/auth/callback#access_token=a&refresh_token=b&token_type=bearer`,()=>{},origin);
  assert.equal((await invalid!.complete({} as never)).success,false);
  assert.equal(safeAuthDestination('https://bad.invalid/phishing?token=secret'),'/?view=groups');
  assert.equal(takeAuthDestination({getItem:()=>JSON.stringify({at:0,path:'/chat'}),removeItem:()=>{}},1_000_000),null);
});
