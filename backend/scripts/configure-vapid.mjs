// Run only on a computer already authenticated with Wrangler.
// Production private material stays in memory and is piped directly to Cloudflare.
import { spawnSync } from 'node:child_process';

const API='https://daily-intelligence-api.moolanemanuelethomas.workers.dev';
const SUBJECT='https://emanuelemoolan8.github.io/daily-intelligence/';
const WORKER='daily-intelligence-api';
async function main(){
 const response=await fetch(API+'/api/config',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Could not check existing backend configuration. No keys changed.');
 const existing=await response.json();
 if(existing.vapidPublicKey)throw Error('A public VAPID key already exists. Refusing to rotate keys and invalidate subscriptions.');
 // Check authentication before generating any production key material.
 const auth=spawnSync('wrangler',['whoami'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 if(auth.error||auth.status!==0||!/Account ID/i.test(auth.stdout))throw Error('Wrangler must be installed and signed in first. No keys generated.');
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const publicKey=Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey)).toString('base64url');
 const privateJwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
 const proof=new TextEncoder().encode('Daily Intelligence VAPID pair verification');
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,proof);
 if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pair.publicKey,signature,proof))throw Error('Key verification failed.');
 const result=spawnSync('wrangler',['secret','bulk','--name',WORKER],{
  input:JSON.stringify({VAPID_PUBLIC_KEY:publicKey,VAPID_PRIVATE_JWK:JSON.stringify(privateJwk),VAPID_SUBJECT:SUBJECT}),
  encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,WRANGLER_LOG:'error'}
 });
 // Never forward raw command output: error paths must not accidentally reveal input.
 if(result.error||result.status!==0)throw Error('Cloudflare secret upload failed. No secret values were logged. Check Cloudflare before retrying.');
 const verified=await fetch(API+'/api/config',{signal:AbortSignal.timeout(15000)});
 if(!verified.ok)throw Error('Secrets uploaded, but live configuration could not be checked. Do not regenerate keys.');
 const config=await verified.json();
 if(config.vapidPublicKey!==publicKey||!config.pushEnabled)throw Error('Secrets uploaded, but live readiness check failed. Do not regenerate keys.');
 console.log('Matching VAPID keys configured; live public key and push readiness verified. No private key saved locally.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
