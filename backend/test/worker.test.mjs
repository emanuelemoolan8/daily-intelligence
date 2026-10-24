import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

// Ephemeral test keys: never saved or printed, never sent to a push provider.
const pair = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const privateJwk = await crypto.subtle.exportKey('jwk',pair.privateKey);
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey)).toString('base64url');
const subscription = {endpoint:'https://fcm.googleapis.com/fcm/send/test-only',keys:{p256dh:publicKey,auth:Buffer.alloc(16,1).toString('base64url')}};
const origin = 'https://emanuelemoolan8.github.io';
function environment(){
 const records=new Map();
 const kv={async put(k,v){records.set(k,v)},async get(k,type){const v=records.get(k)||null;return type==='json'&&v?JSON.parse(v):v},async delete(k){records.delete(k)},async list(){return {keys:[...records.keys()].map(name=>({name})),list_complete:true}}};
 return {records,SUBSCRIPTIONS:kv,VAPID_PRIVATE_JWK:JSON.stringify(privateJwk),VAPID_PUBLIC_KEY:publicKey,VAPID_SUBJECT:'https://emanuelemoolan8.github.io/daily-intelligence/'};
}
const preferences={subscription,time:'08:30',timeZone:'Europe/Rome',city:'Sesto San Giovanni, Italy',topics:[],language:'en'};
function request(path,body,requestOrigin=origin){return new Request('https://example.workers.dev'+path,{method:body===undefined?'GET':'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})}
async function subscribe(env,overrides={}){return worker.fetch(request('/api/subscribe',{...preferences,...overrides}),env)}

test('config exposes only public key and checks matching coordinates',async()=>{
 const env=environment();const good=await (await worker.fetch(request('/api/config'),env)).json();assert.equal(good.pushEnabled,true);assert.equal(good.vapidPublicKey,publicKey);assert(!JSON.stringify(good).includes(privateJwk.d));
 env.VAPID_PUBLIC_KEY='wrong';assert.equal((await (await worker.fetch(request('/api/config'),env)).json()).pushEnabled,false);
});
test('subscribe, edit preferences, preserve sent marker, then remove backend record',async()=>{
 const env=environment();assert.equal((await subscribe(env)).status,200);assert.equal(env.records.size,1);
 const key=[...env.records.keys()][0],stored=JSON.parse(env.records.get(key));stored.lastSent='2026-10-24';env.records.set(key,JSON.stringify(stored));
 assert.equal((await subscribe(env,{city:'Rome, Italy'})).status,200);assert.equal(JSON.parse(env.records.get(key)).lastSent,'2026-10-24');
 assert.equal((await worker.fetch(request('/api/unsubscribe',{subscription}),env)).status,200);assert.equal(env.records.size,0);
});
test('reject unsafe endpoint, malformed keys, null JSON, invalid timezone and foreign origin',async()=>{
 const env=environment();
 for(const endpoint of ['https://127.0.0.1/','https://attacker.example/','https://fcm.googleapis.com.evil.example/fcm/send/a','https://user:pass@fcm.googleapis.com/fcm/send/a'])assert.equal((await subscribe(env,{subscription:{...subscription,endpoint}})).status,400);
 assert.equal((await subscribe(env,{subscription:{...subscription,keys:{auth:'x',p256dh:'x'}}})).status,400);
 assert.equal((await subscribe(env,{timeZone:undefined})).status,400);
 assert.equal((await worker.fetch(request('/api/subscribe',null),env)).status,400);
 assert.equal((await worker.fetch(request('/api/subscribe',preferences,'https://attacker.example'),env)).status,403);
 assert.equal(env.records.size,0);
});
test('unsubscribe requires saved subscription keys',async()=>{
 const env=environment();await subscribe(env);const other={...subscription,keys:{...subscription.keys,auth:Buffer.alloc(16,2).toString('base64url')}};
 assert.equal((await worker.fetch(request('/api/unsubscribe',{subscription:other}),env)).status,403);assert.equal(env.records.size,1);
});
test('hourly cron waits until selected minute, signs valid VAPID JWT and avoids repeat',async()=>{
 const env=environment();await subscribe(env);let sent=0;const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  sent++;assert.equal(url,subscription.endpoint);assert.equal(options.redirect,'error');
  const jwt=options.headers.Authorization.match(/^vapid t=([^,]+)/)[1];const [head,body,signature]=jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(body,'base64url')).aud,'https://fcm.googleapis.com');
  assert(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pair.publicKey,Buffer.from(signature,'base64url'),new TextEncoder().encode(head+'.'+body)));
  return new Response(null,{status:201});
 };
 try{
  await worker.scheduled({scheduledTime:Date.parse('2026-10-24T06:00:00Z')},env,{});assert.equal(sent,0);
  await worker.scheduled({scheduledTime:Date.parse('2026-10-24T07:00:00Z')},env,{});assert.equal(sent,1);
  await worker.scheduled({scheduledTime:Date.parse('2026-10-24T07:00:00Z')},env,{});assert.equal(sent,1);
 }finally{globalThis.fetch=original}
});
test('fractional offsets and next-day midnight window use correct local date',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(null,{status:201});
 try{
  const india=environment();await subscribe(india,{timeZone:'Asia/Kolkata',time:'08:45'});
  await worker.scheduled({scheduledTime:Date.parse('2026-10-24T03:00:00Z')},india,{});assert.equal(JSON.parse([...india.records.values()][0]).lastSent,null);
  await worker.scheduled({scheduledTime:Date.parse('2026-10-24T04:00:00Z')},india,{});assert.equal(JSON.parse([...india.records.values()][0]).lastSent,'2026-10-24');
  const midnight=environment();await subscribe(midnight,{timeZone:'UTC',time:'23:30'});
  await worker.scheduled({scheduledTime:Date.parse('2026-10-25T00:00:00Z')},midnight,{});assert.equal(JSON.parse([...midnight.records.values()][0]).lastSent,'2026-10-24');
 }finally{globalThis.fetch=original}
});
test('expired push subscriptions are deleted; provider failure is not marked sent',async()=>{
 const original=globalThis.fetch;
 try{for(const status of [410,503]){
  const env=environment();await subscribe(env);globalThis.fetch=async()=>new Response(null,{status});
  await worker.scheduled({scheduledTime:Date.parse('2026-10-24T07:00:00Z')},env,{});
  if(status===410)assert.equal(env.records.size,0);else assert.equal(JSON.parse([...env.records.values()][0]).lastSent,null);
 }}finally{globalThis.fetch=original}
});
test('local news falls back when first provider fails, decodes RSS and safe article URLs',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return calls===1?new Response('',{status:503}):new Response('<rss><channel><item><title><![CDATA[City &amp; news]]></title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fpublisher.example%2Farticle&amp;ref=1</link><News:Source>Publisher</News:Source></item><item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>')};
 try{const res=await worker.fetch(request('/api/local?city=Rome'),environment()),data=await res.json();assert.equal(res.status,200);assert.equal(data.provider,'Bing News');assert.equal(data.items.length,1);assert.equal(data.items[0].title,'City & news');assert.equal(data.items[0].url,'https://publisher.example/article')}
 finally{globalThis.fetch=original}
});
test('local news reports unavailable instead of treating an HTML error as an empty feed',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('<html>Error</html>');
 try{assert.equal((await worker.fetch(request('/api/local?city=Rome'),environment())).status,503)}finally{globalThis.fetch=original}
});
