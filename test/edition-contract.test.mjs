import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html=readFileSync('index.html','utf8');
assert(!/http-equiv=["']refresh["']/i.test(html),'Homepage must never redirect to dated editions');
assert(html.includes('di-floating-nav'),'Floating navigation missing');
assert(html.includes('id="di-settings"'),'Settings view missing');
assert(html.includes('id="podcastPlayer"'),'Audio player missing');
assert(html.includes('src="./editions/2026-10-25.js"'),'Expected edition data loader missing');
for(const date of ['2026-10-24','2026-10-25']){
 const source=readFileSync('editions/'+date+'.js','utf8');
 const ctx={window:{}};
 vm.runInNewContext(source,ctx,{timeout:1000});
 const data=ctx.window.DI_EDITION_DATA;
 assert.equal(data.stories.length,12,date+' should have 12 stories');
 for(const story of data.stories){
  assert(story.en_title&&story.ml_title&&story.en_summary&&story.ml_summary,'Incomplete translation');
  assert(Array.isArray(story.deep_en)&&Array.isArray(story.deep_ml),'Missing detailed story');
  assert(/^https:\/\//.test(story.source),'Invalid source URL');
 }
}
console.log('Canonical UI and edition data checks passed');

assert(!html.includes("audio/2026-10-24-"),'Must not play previous edition MP3 on October 25');
assert(html.includes("audio/2026-10-25-"),'Current-edition audio path missing');
assert(!html.includes('Brent closed at $116.72, Ukraine and Russia agreed'),'Stale lead paragraph detected');
