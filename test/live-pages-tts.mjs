import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const expectedDate=process.argv[2];
const base='https://emanuelemoolan8.github.io/daily-intelligence/';
const browser=await chromium.launch({headless:true,executablePath:process.env.DI_CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   window.__ttsCalls=[];
   class Utterance {constructor(text){this.text=text;this.lang='';this.rate=1;this.pitch=1;this.onend=null;this.onerror=null;}}
   Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:Utterance});
   const synth={speaking:false,paused:false,onvoiceschanged:null,getVoices(){return [{name:'English',lang:'en-US',default:true},{name:'Italiano',lang:'it-IT'},{name:'Malayalam',lang:'ml-IN'}]},cancel(){this.speaking=false},speak(u){window.__ttsCalls.push({text:u.text,lang:u.lang});this.speaking=true},pause(){this.paused=true},resume(){this.paused=false}};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
 });
 await page.route('**/audio/**/*.mp3',route=>route.fulfill({status:404,body:''}));
 const response=await page.goto(base+'?ci_live='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response.status(),200,'Public GitHub Pages must return HTTP 200');
 await page.waitForSelector('.headline',{timeout:12000});
 assert.equal(await page.locator('.headline').count(),12,'Live edition has 12 headlines');
 assert.equal(await page.locator('.headline h3[data-lang="en"]').first().innerText(),await page.evaluate(()=>window.DI_EDITION_DATA.stories[0].en_title));
 const edition=await page.evaluate(()=>window.DI_EDITION_DATA.date);
 if(expectedDate)assert.equal(edition,expectedDate,'Public Pages is serving the expected edition');
 const dataResponse=await page.request.get(base+'editions/'+edition+'.js?ci='+Date.now());
 assert.equal(dataResponse.status(),200,'Published edition JS is accessible');
 assert.match(await dataResponse.text(),/DI_EDITION_DATA/);
 assert.deepEqual(await page.locator('#newspaper > section.desk').evaluateAll(desks=>desks.map(d=>d.id)),
  ['front','major','intelligence','dashboard','forward','audit']);
 const publicAudio=[];
 if(expectedDate){
  const manifestResponse=await page.request.get(base+'publication.json?ci='+Date.now());
  assert.equal(manifestResponse.status(),200);
  const manifest=await manifestResponse.json();
  const tracks=['en','ml','it'].flatMap(lang=>['short','full'].map(mode=>`audio/${edition}/${lang}-${mode}.mp3`));
  assert.equal(manifest.date,edition);
  assert.equal(manifest.ready,true);
  assert.deepEqual(manifest.audio,tracks);
  const results=await Promise.all(tracks.map(async path=>{
   const track=await page.request.head(base+path+'?ci='+Date.now());
   assert.equal(track.status(),200,path);
   assert.match(track.headers()['content-type'],/^audio\//,path);
   assert(Number(track.headers()['content-length'])>=5000,path);
   return path;
  }));
  publicAudio.push(...results);
 }
 const player=page.locator('#di-italian-play');assert.equal(await player.isVisible(),true,'Speech play control visible');
 for(const [language,expected] of [['en',/^en/],['ml',/^ml/],['it',/^it/]]){
   await page.evaluate(lang=>{const e=document.querySelector('#lang');e.value=lang;e.dispatchEvent(new Event('change',{bubbles:true}))},language);
   await player.click();
   const last=await page.evaluate(()=>window.__ttsCalls.at(-1));
   assert.ok(last?.text?.length>5,'Speech utterance submitted for '+language);
   assert.match(last.lang,expected,'Speech locale for '+language);
   await page.locator('#di-italian-stop').click();
 }
 assert.deepEqual(errors,[],'No uncaught live-page JavaScript errors');
 console.log(JSON.stringify({edition,liveStatus:response.status(),headlineCount:12,publicAudio,editionAssetStatus:dataResponse.status(),speechCalls:await page.evaluate(()=>window.__ttsCalls.map(x=>({lang:x.lang,length:x.text.length}))),note:'Speech synthesis API is mocked; this validates invocation, not physical sound output.'}));
}finally{await browser.close()}
