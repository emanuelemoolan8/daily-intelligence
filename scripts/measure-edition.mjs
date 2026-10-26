import fs from 'node:fs';
import {readEdition} from './edition.mjs';
export function measure(data,language){
 const brief=[],full=[];
 for(const s of data.stories){brief.push(s[language+'_title'],s[language+'_summary']);full.push(s[language+'_title'],s[language+'_summary'],...s['deep_'+language],s['context_'+language],s['watch_'+language])}
 for(const s of data.sections){brief.push(s[language+'_title'],s[language+'_intro']);full.push(s[language+'_title'],s[language+'_intro']);for(const c of s.cards){brief.push(c[language+'_title'],c[language+'_summary']);full.push(c[language+'_title'],c[language+'_summary'],c[language+'_deep'])}}
 for(const f of data.forecasts){brief.push(f[language]);full.push(f[language],f[language==='en'?'evidence':'evidence_'+language],f[language==='en'?'counter':'counter_'+language],f[language==='en'?'trigger':'trigger_'+language],f.deadline)}
 const words=items=>items.flat(Infinity).filter(x=>typeof x==='string'&&x.trim()).join(' ').trim().split(/\s+/u).length;
 return {short:words(brief),full:words(full)};
}
if(process.argv[1]?.endsWith('measure-edition.mjs')){
 const {date,data}=readEdition(process.argv[2]);
 for(const language of ['en','ml','it']){const result=measure(data,language);data.counts[language]=result.full;data.counts[language+'_short']=result.short}
 if(process.argv.includes('--write'))fs.writeFileSync(`editions/${date}.js`,'window.DI_EDITION_DATA='+JSON.stringify(data)+';\n');
 console.log(JSON.stringify({date,counts:data.counts}));
}
