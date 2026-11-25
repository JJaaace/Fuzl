import { Router, json } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { chatCreateSchema,chatRenameSchema,chatInviteInput,chatJoinSchema,chatSendSchema,chatRequestInput,chatApplySchema,chatMappingSchema,guestTokenSchema,recordId } from '@fuzl/planning';
import type { ChatActor } from '@fuzl/planning';
import { verifyOrganizer } from '../accounts/auth.js';
import type { VerifyOrganizer } from '../accounts/auth.js';
import { database } from '../accounts/database.js';
import { ExtractionError } from '../extraction/errors.js';
import { ensureAIConfigured } from '../extraction/configuration.js';
import { ChatStore } from './store.js';
import { ChatPlanner } from './planning.js';
import type { ChatExtractor } from './planning.js';
export interface ChatOptions {store?:()=>ChatStore;verify?:VerifyOrganizer;extract?:ChatExtractor;checkAI?:typeof ensureAIConfigured;now?:()=>number;streamIntervalMs?:number;streamDurationMs?:number}
export function chatRouter(options:ChatOptions={}){
  const router=Router();let stored:ChatStore|undefined,planner:ChatPlanner|undefined,streams=0;
  const store=()=>stored??=(options.store?.()??new ChatStore(database(),options.now));
  const planning=()=>planner??=new ChatPlanner(store(),options.extract,options.checkAI,options.now);
  const buckets=new Map<string,{at:number;reads:number;writes:number}>();
  const parse=<T>(schema:{parse(v:unknown):T},value:unknown):T=>{try{return schema.parse(value);}catch{throw new ExtractionError(400,'chat_input','Check the conversation fields and version. Your draft was kept.');}};
  router.use((req,res,next)=>{
    res.set({'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',Vary:'Authorization, X-Chat-Credential, X-Chat-Invite'});
    const origin=req.get('origin'),allowed=process.env.APP_ORIGIN?[process.env.APP_ORIGIN]:['http://127.0.0.1:5173','http://localhost:5173'];
    if(origin&&!allowed.includes(origin))throw new ExtractionError(403,'origin_rejected','Open the configured Fuzl website for real conversations. This preview cannot access private groups.');
    const now=Date.now();for(const [key,value] of buckets)if(now-value.at>=60000)buckets.delete(key);
    const key=req.ip??'local',bucket=buckets.get(key)??{at:now,reads:0,writes:0};if(!buckets.has(key)&&buckets.size>=1000)throw new ExtractionError(429,'chat_busy','Conversation service is busy. Retry deliberately later.');buckets.set(key,bucket);
    if(req.method==='GET'){if(++bucket.reads>240)throw new ExtractionError(429,'chat_rate_limit','Pause before refreshing the conversation again.');}else if(++bucket.writes>40)throw new ExtractionError(429,'chat_rate_limit','Too many conversation changes. Wait a minute before retrying.');
    if(['POST','PUT','PATCH'].includes(req.method)&&!req.is('application/json'))throw new ExtractionError(415,'json_required','Send conversation changes as JSON.');next();
  },json({limit:'128kb',inflate:false}));
  async function actor(req:Request):Promise<ChatActor>{
    const guest=req.get('x-chat-credential'),authorization=req.get('authorization');
    if(guest){if(authorization)throw new ExtractionError(400,'chat_identity','Choose one conversation identity.');return{credential:parse(guestTokenSchema,guest)};}
    const token=/^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(authorization??'')?.[1];if(!token)throw new ExtractionError(401,'chat_identity','Sign in or join this conversation with its dedicated browser credential.');return{subject:await(options.verify??verifyOrganizer)(token)};
  }
  const id=(req:Request)=>parse(recordId,req.params.id);
  const invite=(req:Request)=>parse(guestTokenSchema,req.get('x-chat-invite'));
  router.get('/threads',async(req,res)=>{const a=await actor(req);if(!a.subject)throw new ExtractionError(401,'chat_account','Sign in to list account conversations.');res.json(await store().list(a.subject));});
  router.post('/threads',async(req,res)=>{const a=await actor(req);if(!a.subject)throw new ExtractionError(401,'chat_account','Only a signed-in organizer can create an outing thread.');const threadId=await store().create(a.subject,parse(chatCreateSchema,req.body));res.status(201).json(await store().thread(a,threadId));});
  router.get('/invite',async(req,res)=>res.json(await store().invitePreview(invite(req))));
  router.post('/join',async(req,res)=>{const a=req.get('authorization')?await actor(req):null;res.json(await store().join(invite(req),a?.subject??null,parse(chatJoinSchema,req.body)));});
  router.get('/threads/:id',async(req,res)=>res.json(await store().thread(await actor(req),id(req))));
  router.put('/threads/:id',async(req,res)=>{const input=parse(chatRenameSchema,req.body);await store().rename(await actor(req),id(req),input.title,input.version);res.json({ok:true});});
  router.get('/threads/:id/invites',async(req,res)=>res.json(await store().invitations(await actor(req),id(req))));
  router.post('/threads/:id/invites',async(req,res)=>res.json(await store().invite(await actor(req),id(req),parse(chatInviteInput,req.body))));
  router.delete('/threads/:id/invites/:inviteId',async(req,res)=>{await store().revoke(await actor(req),id(req),parse(recordId,req.params.inviteId));res.json({ok:true});});
  router.delete('/threads/:id/members/:memberId',async(req,res)=>{await store().remove(await actor(req),id(req),parse(recordId,req.params.memberId));res.json({ok:true});});
  router.put('/threads/:id/members/:memberId',async(req,res)=>{const input=parse(chatMappingSchema,req.body);await store().mapMember(await actor(req),id(req),parse(recordId,req.params.memberId),input.planningParticipantId,input.contentVersion);res.json({ok:true});});
  router.get('/threads/:id/messages',async(req,res)=>{const before=req.query.before===undefined?undefined:parse(z.coerce.number().int().positive(),req.query.before),changesAfter=req.query.changesAfter===undefined?undefined:parse(z.coerce.number().int().nonnegative(),req.query.changesAfter);res.json(await store().page(await actor(req),id(req),{before,changesAfter}));});
  router.get('/threads/:id/messages/:messageId',async(req,res)=>res.json(await store().message(await actor(req),id(req),parse(recordId,req.params.messageId))));
  router.post('/threads/:id/messages',async(req,res)=>res.status(201).json(await store().send(await actor(req),id(req),parse(chatSendSchema,req.body))));
  router.delete('/threads/:id/messages/:messageId',async(req,res)=>{await store().deleteMessage(await actor(req),id(req),parse(recordId,req.params.messageId));res.json({ok:true});});
  router.post('/threads/:id/review',async(req,res)=>res.json(await store().prepareReview(await actor(req),id(req),parse(z.strictObject({contentVersion:z.number().int().nonnegative(),sharedVersion:z.number().int().nonnegative()}),req.body))));
  router.post('/threads/:id/requests',async(req,res)=>{
    const a=await actor(req),threadId=id(req),input=parse(chatRequestInput,req.body);if(process.env.NODE_ENV==='production'&&input.kind==='plan'&&!a.subject)throw new ExtractionError(401,'chat_account_required','Sign in to request AI planning.');const controller=new AbortController();const close=()=>{if(!res.writableEnded)controller.abort();};res.once('close',close);
    try{res.json(await planning().run(a,threadId,input,controller.signal));}finally{res.off('close',close);}
  });
  router.post('/threads/:id/requests/:requestId/cancel',async(req,res)=>{await planning().cancel(await actor(req),id(req),parse(recordId,req.params.requestId));res.json({ok:true});});
  router.post('/threads/:id/requests/:requestId/apply',async(req,res)=>res.json(await store().apply(await actor(req),id(req),parse(recordId,req.params.requestId),parse(chatApplySchema,req.body))));
  router.get('/threads/:id/version',async(req,res)=>res.json({version:await store().version(await actor(req),id(req))}));
  router.get('/threads/:id/events',async(req,res)=>{
    const a=await actor(req),threadId=id(req);let version=await store().version(a,threadId),closed=false,checking=false;
    if(streams>=40)throw new ExtractionError(429,'chat_stream_limit','Too many live views. Close an extra tab and reconnect deliberately.');streams++;
    res.set({'Content-Type':'text/event-stream','X-Accel-Buffering':'no'});res.flushHeaders();res.write(`event: sync\nid: ${version}\ndata: ${JSON.stringify({version})}\n\n`);
    const tick=async()=>{if(checking||closed)return;checking=true;try{const next=await store().version(a,threadId);if(closed)return;if(next!==version){version=next;if(!res.write(`event: sync\nid: ${version}\ndata: ${JSON.stringify({version})}\n\n`))cleanup();}else res.write(': keepalive\n\n');}catch{if(!closed)res.write('event: revoked\ndata: {"code":"chat_access_unavailable"}\n\n');cleanup();}finally{checking=false;}};
    const interval=setInterval(()=>void tick(),options.streamIntervalMs??1000),end=setTimeout(()=>cleanup(),options.streamDurationMs??15000);
    function cleanup(){if(closed)return;closed=true;streams--;clearInterval(interval);clearTimeout(end);res.end();}
    res.once('close',cleanup);
  });
  router.use((error:unknown,req:Request,_res:unknown,next:(e:unknown)=>void)=>{req.body=undefined;if(error instanceof ExtractionError)return next(error);next(new ExtractionError(503,'chat_unavailable','Conversation storage or response verification is unavailable. Your draft was kept; check migrations and reconnect deliberately.'));});
  return router;
}
