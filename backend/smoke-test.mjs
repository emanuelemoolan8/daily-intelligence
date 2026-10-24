// Run: node backend/smoke-test.mjs
// Optional: DI_API_BASE=https://your-worker.workers.dev node backend/smoke-test.mjs
const base=(process.env.DI_API_BASE||'https://daily-intelligence-api.moolanemanuelethomas.workers.dev').replace(/\/$/,'');
async function check(path,validate){
  const response=await fetch(base+path,{signal:AbortSignal.timeout(12000)});
  const data=await response.json();
  if(!response.ok||!validate(data))throw Error(path+': unexpected response '+response.status+' '+JSON.stringify(data).slice(0,250));
  console.log('PASS',path);
}
try{
 await check('/api/config',x=>typeof x.pushEnabled==='boolean'&&typeof x.vapidPublicKey==='string'&&x.vapidPublicKey.length>80);
 await check('/api/local?city='+encodeURIComponent('Sesto San Giovanni, Italy'),x=>Array.isArray(x.items)&&typeof x.city==='string');
 console.log('Backend smoke checks passed. Push delivery and scheduled trigger still require separate verification.');
}catch(error){console.error('FAIL',error.message);process.exitCode=1;}
