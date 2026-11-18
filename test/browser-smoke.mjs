import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const server=createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep)&&file!==root){res.writeHead(403).end();return}try{if(statSync(file).isDirectory())file=resolve(file,'index.html');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(readFileSync(file))}catch{res.writeHead(404).end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.DI_CHROMIUM_PATH,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.headline',{timeout:12000});
 assert.equal(await page.locator('.headline').count(),12,'All twelve headlines render');
 assert.equal(await page.locator('.headline h3[data-lang="en"]').first().innerText(),await page.evaluate(()=>window.DI_EDITION_DATA.stories[0].en_title));
 await page.waitForFunction(()=>!document.getElementById('podcastAudio').hidden||!document.getElementById('di-italian-tts').hidden);
 assert.equal(await page.locator('#podcastPlayer').isVisible(),true,'Listening controls are visible');
 await page.evaluate(()=>{const el=document.querySelector('#lang');el.value='it';el.dispatchEvent(new Event('change',{bubbles:true}))});
 assert.equal(await page.locator('.headline h3[data-lang="en"]').first().innerText(),await page.evaluate(()=>window.DI_EDITION_DATA.italianHeadlines[0][0]));
 if(await page.evaluate(()=>window.DI_EDITION_DATA.localization==='complete')){
  await page.locator('#full').click();
  assert.equal(await page.locator('.article-body [data-lang="en"] p').first().innerText(),await page.evaluate(()=>window.DI_EDITION_DATA.stories[0].deep_it[0]),'Full Italian article is rendered, not English fallback');
  for(const id of ['intelligence','dashboard','forward','audit']){
   const titles=await page.locator('#'+id+' .card h3[data-lang="en"]').allTextContents();
   assert.deepEqual(titles,await page.evaluate(id=>window.DI_EDITION_DATA.sections.find(s=>s.id===id).cards.map(c=>c.it_title),id),'All desk cards are Italian: '+id);
  }
  assert.equal(await page.locator('.forecast p[data-lang="en"]').first().innerText(),await page.evaluate(()=>window.DI_EDITION_DATA.forecasts[0].it));
  await page.locator('#short').click();
 }

 await page.locator('#full').click();
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForSelector('.headline');
 assert.equal(await page.locator('#lang').inputValue(),'it','Saved Italian language survives reopening');
 assert.equal(await page.locator('#full').getAttribute('aria-pressed'),'true','Saved reading mode survives reopening');
 assert.equal(await page.locator('.headline h3[data-lang="en"]').first().innerText(),await page.evaluate(()=>window.DI_EDITION_DATA.italianHeadlines[0][0]));
 await page.locator('#short').click();
 await page.evaluate(()=>{const el=document.querySelector('#lang');el.value='ml';el.dispatchEvent(new Event('change',{bubbles:true}))});
 const malayalamTitle=page.locator('.headline h3[data-lang="ml"]').first();
 assert.equal(await malayalamTitle.isVisible(),true);
 assert.equal(await malayalamTitle.innerText(),await page.evaluate(()=>window.DI_EDITION_DATA.stories[0].ml_title));
 await page.evaluate(()=>{const el=document.querySelector('#lang');el.value='en';el.dispatchEvent(new Event('change',{bubbles:true}))});
 await page.locator('#full').click();
 assert.equal(await page.locator('#full').getAttribute('aria-pressed'),'true');
 await page.locator('#short').click();
 assert.equal(await page.locator('#short').getAttribute('aria-pressed'),'true');
 const edition=await page.evaluate(()=>window.DI_EDITION_DATA.date);
 if(process.env.DI_REQUIRE_RECORDINGS==='1'){
  for(const language of ['en','ml','it']){
   await page.locator('#lang').selectOption(language);
   for(const mode of ['short','full']){
    await page.locator('#'+mode).click();
    await page.waitForFunction(({edition,language,mode})=>{
     const player=document.querySelector('#podcastAudio');
     return !player.hidden && player.getAttribute('src')?.endsWith(`audio/${edition}/${language}-${mode}.mp3`);
    },{edition,language,mode});
   }
  }
 }
 assert.deepEqual(errors,[],'No uncaught browser errors');
 // A browser can retain an older payload while receiving the new shell.
 const cached=JSON.parse(readFileSync('editions/2026-10-25.js','utf8').replace(/^window\.DI_EDITION_DATA=/,'').trim().replace(/;$/,''));
 delete cached.date;delete cached.italianHeadlines;
 const legacyPage=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 await legacyPage.route('**/editions/latest.js*',route=>route.fulfill({contentType:'text/javascript',body:'document.write(\'<script src="./editions/2026-10-25.js"><\\/script>\');'}));
 await legacyPage.route('**/editions/2026-10-25.js',route=>route.fulfill({contentType:'text/javascript',body:'window.DI_EDITION_DATA='+JSON.stringify(cached)}));
 await legacyPage.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
 await legacyPage.waitForFunction(()=>document.getElementById('podcastAudio').getAttribute('src')?.includes('audio/2026-10-25/'));
 await legacyPage.evaluate(()=>{const el=document.querySelector('#lang');el.value='it';el.dispatchEvent(new Event('change',{bubbles:true}))});
 assert.ok((await legacyPage.locator('.headline h3[data-lang="en"]').first().innerText()).trim(),'Cached older payload must not erase headlines');
 await legacyPage.close();
 console.log('Mobile browser and cached-payload smoke checks passed');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
