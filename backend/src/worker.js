// Deploy with Cloudflare Workers: wrangler deploy. Requires KV binding SUBSCRIPTIONS and VAPID keys.
const headers={'Access-Control-Allow-Origin':'https://emanuelemoolan8.github.io','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const text=(v)=>String(v||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
function validCity(s){return typeof s==='string'&&s.length>1&&s.length<=100&&!/[<>]/.test(s)}
function validTime(s){return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)}
function validZone(s){try{new Intl.DateTimeFormat('en',{timeZone:s});return true}catch{return false}}
function validSubscription(s){return s&&typeof s.endpoint==='string'&&s.endpoint.startsWith('https://')&&s.endpoint.length<2000&&s.keys?.p256dh&&s.keys?.auth}
async function digest(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function escapeXml(s){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')}
async function localNews(city){
 const q=encodeURIComponent(city+' when:2d');const url='https://news.google.com/rss/search?q='+q+'&hl=en&gl=US&ceid=US:en';
 const res=await fetch(url,{headers:{'User-Agent':'DailyIntelligence/1.0'}});if(!res.ok)throw Error('News source unavailable');
 const xml=await res.text();const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,12).map(m=>{const s=m[1];const val=k=>escapeXml(s.match(new RegExp('<'+k+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+k+'>'))?.[1]||'');return {title:text(val('title')),url:text(val('link')),published:text(val('pubDate')),source:text(val('source'))}}).filter(x=>x.title&&x.url.startsWith('https://'));
 return {city,items,notice:'Search results from Google News RSS; relevance and local accuracy are not independently verified. Open source links to read full reporting.'};
}
const b64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function vapidJwt(env,audience){
 const now=Math.floor(Date.now()/1000);const head=b64url(new TextEncoder().encode(JSON.stringify({typ:'JWT',alg:'ES256'})));const body=b64url(new TextEncoder().encode(JSON.stringify({aud:audience,exp:now+3600,sub:env.VAPID_SUBJECT})));
 const jwk=JSON.parse(env.VAPID_PRIVATE_JWK);const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const data=head+'.'+body;const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(data));return data+'.'+b64url(sig);
}
async function sendPush(env,sub){
 const endpoint=new URL(sub.endpoint);const jwt=await vapidJwt(env,endpoint.origin);
 return fetch(sub.endpoint,{method:'POST',headers:{'TTL':'3600','Authorization':'vapid t='+jwt+', k='+env.VAPID_PUBLIC_KEY,'Content-Length':'0'}});
}
export default {
 async fetch(request,env){
  if(request.method==='OPTIONS')return new Response(null,{headers});
  const url=new URL(request.url);
  if(url.pathname==='/api/config')return json({vapidPublicKey:env.VAPID_PUBLIC_KEY||null,pushEnabled:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_JWK&&env.VAPID_SUBJECT&&env.SUBSCRIPTIONS)});
  if(url.pathname==='/api/local'&&request.method==='GET'){
    const city=url.searchParams.get('city');if(!validCity(city))return json({error:'Invalid city'},400);
    try{return json(await localNews(city))}catch(e){return json({error:'Local news feed unavailable. Please retry later.'},503)}
  }
  if(url.pathname==='/api/subscribe'&&request.method==='POST'){
    if(!env.SUBSCRIPTIONS)return json({error:'Push storage is not configured'},503);
    let data;try{data=await request.json()}catch{return json({error:'Invalid JSON'},400)}
    if(!validSubscription(data.subscription)||!validTime(data.time)||!validZone(data.timeZone)||!validCity(data.city))return json({error:'Invalid subscription or preferences'},400);
    const id=await digest(data.subscription.endpoint);await env.SUBSCRIPTIONS.put('sub:'+id,JSON.stringify({subscription:data.subscription,time:data.time,timeZone:data.timeZone,city:data.city,topics:Array.isArray(data.topics)?data.topics.slice(0,20):[],language:data.language==='ml'?'ml':'en',lastSent:null}));
    return json({saved:true});
  }
  return json({error:'Not found'},404);
 },
 async scheduled(event,env,ctx){
  if(!env.SUBSCRIPTIONS||!env.VAPID_PRIVATE_JWK)return;
  let cursor;do{
   const page=await env.SUBSCRIPTIONS.list({prefix:'sub:',cursor,limit:100});
   for(const entry of page.keys){ctx.waitUntil((async()=>{
    const raw=await env.SUBSCRIPTIONS.get(entry.name);if(!raw)return;const item=JSON.parse(raw);
    const local=new Intl.DateTimeFormat('en-CA',{timeZone:item.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const parts=Object.fromEntries(local.map(x=>[x.type,x.value]));
    const date=parts.year+'-'+parts.month+'-'+parts.day;const current=parts.hour+':'+parts.minute;
    // Cron runs hourly; match chosen hour, not minute, and avoid duplicate notifications.
    if(current.slice(0,2)!==item.time.slice(0,2)||item.lastSent===date)return;
    const response=await sendPush(env,item.subscription);
    if(response.status===404||response.status===410){await env.SUBSCRIPTIONS.delete(entry.name);return}
    if(response.ok){item.lastSent=date;await env.SUBSCRIPTIONS.put(entry.name,JSON.stringify(item))}
   })().catch(err=>console.error('push error',err)))}
   cursor=page.cursor;
  }while(cursor);
 }
};
