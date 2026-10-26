import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readEdition} from '../scripts/edition.mjs';
const {date,data}=readEdition();
test('latest edition has metadata and all six desks',()=>{
 assert.equal(data.date,date);
 assert.equal(data.stories.length,12);
 assert.deepEqual(Array.from(data.sections,s=>s.id),['intelligence','dashboard','forward','audit']);
 assert.equal(data.italianHeadlines.length,data.stories.length);
 assert(data.audit.length>0&&data.lead.en&&data.lead.ml);
 for(const section of data.sections)assert(section.cards.length>0);
});
test('next edition narration uses its own date and includes all six desks',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'di-next-'));
 try{
  fs.cpSync('scripts',path.join(temp,'scripts'),{recursive:true});fs.mkdirSync(path.join(temp,'editions'));
  const next=JSON.parse(JSON.stringify(data));next.date='2026-10-27';next.stories[0].en_title='A different verified story';
  fs.writeFileSync(path.join(temp,'editions/2026-10-27.js'),'window.DI_EDITION_DATA='+JSON.stringify(next));
  fs.writeFileSync(path.join(temp,'editions/latest.js'),"document.write('<script src=\"./editions/2026-10-27.js\"><\\/script>');");
  execFileSync(process.execPath,['scripts/build-audio-scripts.mjs'],{cwd:temp});
  const narration=fs.readFileSync(path.join(temp,'audio/scripts/2026-10-27/en-full.txt'),'utf8');
  assert(narration.includes('A different verified story'));
  for(const section of next.sections)assert(narration.includes(section.en_title));
  assert(!fs.existsSync(path.join(temp,'audio/scripts/2026-10-25')));
  assert.throws(()=>execFileSync(process.execPath,['scripts/prepare-publication.mjs'],{cwd:temp,stdio:'pipe'}));
  assert(!fs.existsSync(path.join(temp,'publication.json')),'Readiness must not be announced before recordings exist');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('reject path traversal and mismatched edition date',()=>{
 assert.throws(()=>readEdition('../index'));
});
test('inline scripts parse without browser execution',()=>{
 const html=fs.readFileSync('index.html','utf8');
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Function(match[1]);
});
