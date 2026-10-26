import fs from 'node:fs';
import {readEdition} from './edition.mjs';
const {date}=readEdition(process.argv[2]);
const audio=['en','ml','it'].flatMap(language=>['short','full'].map(mode=>`audio/${date}/${language}-${mode}.mp3`));
for(const file of audio)if(fs.statSync(file).size<5000)throw Error(`Missing or too small: ${file}`);
fs.writeFileSync('publication.json',JSON.stringify({date,ready:true,audio},null,2)+'\n');
console.log(`Publication manifest ready: ${date}`);
