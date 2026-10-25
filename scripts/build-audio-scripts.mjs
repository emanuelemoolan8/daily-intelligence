import fs from 'node:fs';
import vm from 'node:vm';
const edition='2026-10-25';
const src=fs.readFileSync('editions/'+edition+'.js','utf8');
const sandbox={window:{}};vm.runInNewContext(src,sandbox,{timeout:5000});
const stories=sandbox.window.DI_EDITION_DATA.stories;
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/const italianHeadlines=(\[.*?\]);\s*function italianStoryText/s);
if(!match)throw Error('Italian headline data not found');
const it=JSON.parse(match[1]);
if(stories.length!==12||it.length!==stories.length)throw Error('Story count mismatch');
fs.mkdirSync('audio/scripts/'+edition,{recursive:true});
for(const lang of ['en','ml','it'])for(const depth of ['short','full']){
 const lines=[];
 for(let i=0;i<stories.length;i++){
  const s=stories[i];
  if(lang==='it'){
   lines.push(it[i][0],it[i][1]);
   // Full Italian articles have not been translated: don't mislabel English as Italian audio.
   if(depth==='full')lines.push('Per ulteriori approfondimenti, consulta il testo inglese dell’articolo.');
  }else{
   lines.push(lang==='en'?s.en_title:s.ml_title,lang==='en'?s.en_summary:s.ml_summary);
   if(depth==='full')lines.push(...(lang==='en'?s.deep_en:s.deep_ml),lang==='en'?s.context_en:s.context_ml,lang==='en'?s.watch_en:s.watch_ml);
  }
 }
 fs.writeFileSync('audio/scripts/'+edition+'/'+lang+'-'+depth+'.txt',lines.filter(Boolean).join('\n\n')+'\n');
}
console.log('Prepared 6 narration scripts for '+edition);
