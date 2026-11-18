import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {readEdition} from './edition.mjs';
import {measure} from './measure-edition.mjs';

const languages = ['en', 'ml', 'it'];
const deskIds = ['intelligence', 'dashboard', 'forward', 'audit'];

function text(value, field) {
  assert(typeof value === 'string' && value.trim(), `Missing text: ${field}`);
}

function https(value, field) {
  text(value, field);
  assert.equal(new URL(value).protocol, 'https:', field);
}

function translated(get, field) {
  const values = languages.map(get);
  for (let index = 0; index < languages.length; index++) {
    text(values[index], `${field}.${languages[index]}`);
  }
  assert.match(values[1], /[\u0d00-\u0d7f]/u, `Missing Malayalam script: ${field}`);
  assert.notEqual(values[2], values[0], `Untranslated Italian: ${field}`);
}

export function validateCandidate(date, data) {
  assert.equal(data.date, date);
  assert.equal(data.localization, 'complete');
  assert.match(data.cutoff, /Europe\/Rome/);
  translated(lang => data.lead[lang], 'lead');
  assert.equal(data.stories.length, 12);
  assert.equal(data.italianHeadlines.length, 12);
  const titles = new Set();
  const sources = new Set(Object.values(data.sources));
  for (const source of sources) https(source, 'source library');
  for (const [index, story] of data.stories.entries()) {
    const field = `story ${index + 1}`;
    https(story.source, field);
    assert(sources.has(story.source), `${field} source is absent from source library`);
    text(story.tag, `${field}.tag`);
    assert(!titles.has(story.en_title), `Duplicate story: ${story.en_title}`);
    titles.add(story.en_title);
    for (const key of ['title', 'summary']) translated(lang => story[`${lang}_${key}`], `${field}.${key}`);
    for (const key of ['context', 'watch']) translated(lang => story[`${key}_${lang}`], `${field}.${key}`);
    assert(story.deep_en.length >= 2, `${field} needs reporting and analysis`);
    for (const lang of languages) {
      assert(Array.isArray(story[`deep_${lang}`]), `${field}.deep_${lang}`);
      assert.equal(story[`deep_${lang}`].length, story.deep_en.length, `${field}.deep_${lang}`);
    }
    for (const [paragraph] of story.deep_en.entries()) {
      translated(lang => story[`deep_${lang}`][paragraph], `${field}.deep[${paragraph}]`);
    }
    assert.deepEqual(data.italianHeadlines[index], [story.it_title, story.it_summary]);
  }
  assert.deepEqual(data.sections.map(desk => desk.id), deskIds);
  for (const desk of data.sections) {
    for (const key of ['title', 'intro']) translated(lang => desk[`${lang}_${key}`], `${desk.id}.${key}`);
    assert(desk.cards.length > 0, `Empty desk: ${desk.id}`);
    for (const [index, card] of desk.cards.entries()) {
      for (const key of ['title', 'summary', 'deep']) {
        translated(lang => card[`${lang}_${key}`], `${desk.id}.card[${index}].${key}`);
      }
    }
  }
  assert(data.forecasts.length > 0);
  for (const forecast of data.forecasts) {
    text(forecast.id, 'forecast.id');
    text(forecast.horizon, 'forecast.horizon');
    assert(Number.isFinite(forecast.p) && forecast.p > 0 && forecast.p < 1, forecast.id);
    assert(Date.parse(forecast.deadline) > Date.parse(date), forecast.id);
    translated(lang => forecast[lang], forecast.id);
    for (const key of ['evidence', 'counter', 'trigger']) {
      translated(lang => forecast[lang === 'en' ? key : `${key}_${lang}`], `${forecast.id}.${key}`);
    }
  }
  assert(data.audit.length > 0);
  for (const rows of [data.audit, data.audit_ml, data.audit_it]) {
    assert.equal(rows.length, data.audit.length);
    for (const row of rows) assert.equal(row.length, 2);
  }
  for (const [index] of data.audit.entries()) {
    for (const column of [0, 1]) {
      translated(lang => data[lang === 'en' ? 'audit' : `audit_${lang}`][index][column], `audit[${index}][${column}]`);
    }
  }
  assert(Array.isArray(data.weather));
  assert(data.markets && typeof data.markets === 'object' && !Array.isArray(data.markets));
  assert(Array.isArray(data.metrics));
  for (const metric of data.metrics) {
    assert.equal(metric.length, 3);
    text(metric[0], 'metric label');
    text(metric[1], 'metric value');
    https(metric[2], 'metric source');
  }
  for (const lang of languages) {
    const {short, full} = measure(data, lang);
    assert(full > short && short > 0);
    assert.equal(data.counts[lang], full, `${lang} full word count`);
    assert.equal(data.counts[`${lang}_short`], short, `${lang} short word count`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert(process.argv[2], 'Usage: node scripts/validate-candidate.mjs YYYY-MM-DD');
  const {date, data} = readEdition(process.argv[2]);
  validateCandidate(date, data);
  console.log(`Validated complete English, Malayalam and Italian editorial coverage for ${date}`);
}
