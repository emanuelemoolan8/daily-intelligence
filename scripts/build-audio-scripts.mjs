import fs from 'node:fs';
import {readEdition} from './edition.mjs';
const {date,data}=readEdition(process.argv[2]);
const target=`audio/scripts/${date}`;
fs.mkdirSync(target,{recursive:true});
for(const language of ['en','ml','it'])for(const depth of ['short','full']){
 const lines=[];
 const value=(item,key)=>item[`${key}_${language}`]??item[`${language}_${key}`];
 const add=(...items)=>{for(const item of items.flat(Infinity))if(typeof item==='string'&&item.trim())lines.push(item)};
 for(const [i,story] of data.stories.entries()){
  if(language==='it'&&!story.it_title){
   add(...data.italianHeadlines[i]);
   if(depth==='full')add('Questa edizione offre solo riassunti in italiano. Gli approfondimenti e le altre sezioni non sono ancora tradotti.');
  }else{
   add(value(story,'title'),value(story,'summary'));
   if(depth==='full')add(value(story,'deep'),value(story,'context'),value(story,'watch'));
  }
 }
 if(language!=='it'||data.sections.every(s=>s.it_title)){
  for(const section of data.sections){
   add(value(section,'title'),value(section,'intro'));
   for(const card of section.cards){add(value(card,'title'),value(card,'summary'));if(depth==='full')add(value(card,'deep'))}
   if(section.id==='intelligence')for(const f of data.forecasts){
    add(`${Math.round(f.p*100)}%.`,f[language]);
    if(depth==='full')add(f.deadline,value(f,'evidence'),value(f,'counter'),value(f,'trigger'));
   }
  }
 }
 fs.writeFileSync(`${target}/${language}-${depth}.txt`,lines.join('\n\n')+'\n');
}
console.log(`Prepared six narration scripts for ${date}; Italian coverage follows available translations.`);
