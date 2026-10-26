import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html=readFileSync('index.html','utf8');
assert(!/http-equiv=["']refresh["']/i.test(html),'Homepage must never redirect to dated editions');
assert(html.includes('di-floating-nav'),'Floating navigation missing');
assert(html.includes('id="di-settings"'),'Settings view missing');
assert(html.includes('id="podcastPlayer"'),'Audio player missing');
assert(html.includes('src="./editions/latest.js?v=20261026"'),'Expected latest edition loader missing');
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
assert(html.includes('Device text-to-speech is available'),'Missing speech playback fallback');
assert(!html.includes('Brent closed at $116.72, Ukraine and Russia agreed'),'Stale lead paragraph detected');

const legacy25=readFileSync('daily_intelligence_2026-10-25_bilingual_listen.html','utf8');
assert(legacy25.includes('location.replace'), 'Old 25 October URL must forward to canonical interface');
assert(!legacy25.includes('class="desk"'), 'Old 25 October URL must not duplicate newspaper UI');
assert(html.includes('italian.hidden=false;audio.hidden=true'), 'Speech controls must remain visible for every language');
assert(html.includes('Screen-off playback not guaranteed'), 'Avoid promising unsupported background TTS');

assert(html.includes('D.italianHeadlines'),'Italian headlines must come from edition data');
assert(!html.includes('italianArticleContent'),'Outdated Italian long-form article data must be removed');
assert(html.includes('ANALISI (testo inglese)'),'Untranslated deep analysis must be labelled');

assert(html.includes('./audio/${window.DI_EDITION_DATA.date}/${language.value}-${depth.value}.mp3'),'MP3 track resolver must use edition and controls');
assert(html.includes('audio.hidden=false;italian.hidden=true'),'Only show recorded MP3 player when file exists');

const latest=readFileSync('editions/latest.js','utf8');
assert(html.includes('<script src="./editions/latest.js?v=20261026"></script>'),'Canonical UI must load latest edition pointer');
const pointerDate=latest.match(/editions\/(\d{4}-\d{2}-\d{2})\.js/)?.[1];
assert(pointerDate,'Latest pointer must select a dated edition');
assert(readFileSync('editions/'+pointerDate+'.js','utf8').includes('DI_EDITION_DATA'));

assert(!html.includes('>Sunday, 25 October 2026</div>'),'Shell must not flash an old edition date while loading');
assert(!html.includes('Natural narration · Screen-off listening'),'Do not promise unverified screen-off behaviour');
