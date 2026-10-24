// Deploy with Cloudflare Workers: wrangler deploy. Requires KV binding SUBSCRIPTIONS and VAPID keys.
const headers={'Access-Control-Allow-Origin':'https://emanuelemoolan8.github.io','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const text=(v)=>String(v||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
function validCity(s){return typeof s==='string'&&s.trim().length>1&&s.length<=100&&!/[<>]/.test(s)}
function validTime(s){return typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s)}
function validZone(s){if(typeof s!=='string'||!s||s.length>100)return false;try{new Intl.DateTimeFormat('en',{timeZone:s});return true}catch{return false}}
function validSubscription(s){
 try{
  const u=new URL(s.endpoint);
  const allowed=(u.hostname==='fcm.googleapis.com'&&u.pathname.startsWith('/fcm/send/'))||(u.hostname==='updates.push.services.mozilla.com'&&u.pathname.startsWith('/wpush/'))||u.hostname==='web.push.apple.com';
  const bytes=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(v))return null;return Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))};
  const key=bytes(s.keys?.p256dh),auth=bytes(s.keys?.auth);
  return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.hash&&allowed&&s.endpoint.length<2000&&key?.length===65&&key[0]===4&&auth?.length===16;
 }catch{return false}
}
async function digest(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function escapeXml(s){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')}
function parseFeed(xml){
 if(!/<rss[\s>]/i.test(xml))throw Error('Invalid RSS response');
 return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,12).map(m=>{
  const val=k=>text(escapeXml(m[1].match(new RegExp('<'+k+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+k+'>'))?.[1]||''));
  let url=val('link');try{const u=new URL(url);if(u.hostname==='www.bing.com'&&u.pathname==='/news/apiclick.aspx')url=u.searchParams.get('url')||url}catch{}
  return {title:val('title'),url,published:val('pubDate'),source:val('source')||val('News:Source')};
 }).filter(x=>x.title&&x.url.startsWith('https://'));
}
async function localNews(city){
 const sources=[['Google News','https://news.google.com/rss/search?q='+encodeURIComponent(city+' when:2d')+'&hl=en&gl=US&ceid=US:en'],['Bing News','https://www.bing.com/news/search?q='+encodeURIComponent(city)+'&format=rss&setmkt=en-US']];
 for(const [provider,url] of sources){try{
  const res=await fetch(url,{signal:AbortSignal.timeout(8000),cf:{cacheTtl:900,cacheEverything:true}});
  if(!res.ok)continue;const xml=await res.text();if(xml.length>1000000)continue;const items=parseFeed(xml);
  return {city,provider,items,notice:'Source-linked RSS search results; relevance and local accuracy are not independently verified. Open the links to read the reporting.'};
 }catch{}}
 throw Error('News sources unavailable');
}
const b64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function vapidJwt(env,audience){
 const now=Math.floor(Date.now()/1000);const head=b64url(new TextEncoder().encode(JSON.stringify({typ:'JWT',alg:'ES256'})));const body=b64url(new TextEncoder().encode(JSON.stringify({aud:audience,exp:now+3600,sub:env.VAPID_SUBJECT})));
 const jwk=JSON.parse(env.VAPID_PRIVATE_JWK);const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const data=head+'.'+body;const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(data));return data+'.'+b64url(sig);
}
async function sendPush(env,sub){
 const endpoint=new URL(sub.endpoint);const jwt=await vapidJwt(env,endpoint.origin);
 return fetch(sub.endpoint,{method:'POST',redirect:'error',headers:{'TTL':'3600','Authorization':'vapid t='+jwt+', k='+env.VAPID_PUBLIC_KEY},body:null});
}
function pushReady(env){
 try{
  const k=JSON.parse(env.VAPID_PRIVATE_JWK);
  const coordinate=v=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  if(!env.SUBSCRIPTIONS||k.kty!=='EC'||k.crv!=='P-256'||![k.x,k.y,k.d].every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v)))return false;
  const publicKey=b64url(Uint8Array.from([4,...coordinate(k.x),...coordinate(k.y)]));
  return publicKey===env.VAPID_PUBLIC_KEY&&typeof env.VAPID_SUBJECT==='string'&&/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(env.VAPID_SUBJECT);
 }catch{return false}
}
function dueDate(item,now){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:item.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 const current=Number(parts.hour)*60+Number(parts.minute),[h,m]=item.time.split(':').map(Number),target=h*60+m;
 if((current-target+1440)%1440>=60)return null;
 const day=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)-(current<target?1:0)));
 return day.toISOString().slice(0,10);
}
export default {
 async fetch(request,env){
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==headers['Access-Control-Allow-Origin'])return json({error:'Origin not allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{headers});
  const url=new URL(request.url);
  if(url.pathname==='/api/config'&&request.method==='GET')return json({vapidPublicKey:env.VAPID_PUBLIC_KEY||null,pushEnabled:pushReady(env),schedule:'hourly',deliveryWindowMinutes:60});
  if(url.pathname==='/api/local'&&request.method==='GET'){
    const city=url.searchParams.get('city');if(!validCity(city))return json({error:'Invalid city'},400);
    try{return json(await localNews(city))}catch(e){return json({error:'Local news feed unavailable. Please retry later.'},503)}
  }
  if(url.pathname==='/api/subscribe'&&request.method==='POST'){
    if(!pushReady(env))return json({error:'Push is not configured'},503);
    let data;try{const body=await request.text();if(body.length>8192)return json({error:'Request too large'},413);data=JSON.parse(body)}catch{return json({error:'Invalid JSON'},400)}
    if(!data||!validSubscription(data.subscription)||!validTime(data.time)||!validZone(data.timeZone)||!validCity(data.city))return json({error:'Invalid subscription or preferences'},400);
    const id=await digest(data.subscription.endpoint),key='sub:'+id;
    const previous=await env.SUBSCRIPTIONS.get(key,'json');
    await env.SUBSCRIPTIONS.put(key,JSON.stringify({subscription:data.subscription,time:data.time,timeZone:data.timeZone,city:data.city,topics:Array.isArray(data.topics)?data.topics.filter(t=>typeof t==='string'&&t.length<100).slice(0,20):[],language:data.language==='ml'?'ml':'en',lastSent:previous?.lastSent||null}));
    return json({saved:true});
  }
  if(url.pathname==='/api/unsubscribe'&&request.method==='POST'){
    if(!env.SUBSCRIPTIONS)return json({error:'Push storage is not configured'},503);
    let data;try{const body=await request.text();if(body.length>8192)return json({error:'Request too large'},413);data=JSON.parse(body)}catch{return json({error:'Invalid JSON'},400)}
    if(!validSubscription(data?.subscription))return json({error:'Invalid subscription'},400);
    const key='sub:'+await digest(data.subscription.endpoint),item=await env.SUBSCRIPTIONS.get(key,'json');
    if(item&&(item.subscription.keys.p256dh!==data.subscription.keys.p256dh||item.subscription.keys.auth!==data.subscription.keys.auth))return json({error:'Subscription credentials do not match'},403);
    if(item)await env.SUBSCRIPTIONS.delete(key);
    return json({removed:true});
  }
  return json({error:'Not found'},404);
 },
 async scheduled(event,env,ctx){
  if(!pushReady(env))return;
  let cursor;do{
   const page=await env.SUBSCRIPTIONS.list({prefix:'sub:',cursor,limit:100});
   for(const entry of page.keys){await (async()=>{
    const raw=await env.SUBSCRIPTIONS.get(entry.name);if(!raw)return;const item=JSON.parse(raw);
    if(!validSubscription(item.subscription)||!validTime(item.time)||!validZone(item.timeZone))return;
    const date=dueDate(item,new Date(event.scheduledTime));
    // Send on the first hourly tick at or after the preference, including fractional-offset zones.
    if(!date||item.lastSent===date)return;
    const response=await sendPush(env,item.subscription);
    if(response.status===404||response.status===410){await env.SUBSCRIPTIONS.delete(entry.name);return}
    if(response.ok){item.lastSent=date;await env.SUBSCRIPTIONS.put(entry.name,JSON.stringify(item))}
   })().catch(()=>console.error('Scheduled push failed'))}
   cursor=page.cursor;
  }while(cursor);
 }
};

