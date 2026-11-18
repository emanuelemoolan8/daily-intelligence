import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {readEdition} from './edition.mjs';
import {measure} from './measure-edition.mjs';

const languages = ['en', 'ml', 'it'];
const desks = ['intelligence', 'dashboard', 'forward', 'audit'];

function requireText(value, field) {
  assert(typeof value === 'string' && value.trim(), `Missing ${field}`);
}

function requireSource(value) {
  assert.equal(new URL(value).protocol, 'https:', 'Sources must use HTTPS');
}

export function validateEdition(data) {
  assert.equal(data.localization, 'complete');
  requireText(data.cutoff, 'research cutoff');
  assert.equal(data.stories.length, 12);
  assert.equal(data.italianHeadlines.length, 12);
  assert.deepEqual(Array.from(data.sections, section => section.id), desks);
  assert(data.forecasts.length > 0, 'Missing forecasts');
  assert(data.audit.length > 0, 'Missing audit rows');
  const sourceUrls = Object.values(data.sources);
  assert(sourceUrls.length > 0, 'Missing source library');
  sourceUrls.forEach(requireSource);
  data.metrics.forEach(metric => {
    assert.equal(metric.length, 3);
    metric.forEach(value => requireText(value, 'metric'));
    requireSource(metric[2]);
  });

  for (const [index, story] of data.stories.entries()) {
    requireText(story.tag, 'story tag');
    assert(sourceUrls.includes(story.source), 'Story source missing from source library');
    assert.equal(data.italianHeadlines[index][0], story.it_title);
    assert.equal(data.italianHeadlines[index][1], story.it_summary);
  }
  for (const forecast of data.forecasts) {
    assert(Number.isFinite(forecast.p) && forecast.p > 0 && forecast.p < 1);
    assert(Number.isFinite(Date.parse(forecast.deadline)), 'Invalid forecast deadline');
    requireText(forecast.id, 'forecast ID');
    requireText(forecast.horizon, 'forecast horizon');
  }

  for (const language of languages) {
    requireText(data.lead?.[language], `${language} lead`);
    for (const story of data.stories) {
      for (const field of ['title', 'summary']) requireText(story[`${language}_${field}`], `${language} story ${field}`);
      for (const field of ['context', 'watch']) requireText(story[`${field}_${language}`], `${language} story ${field}`);
      const paragraphs = story[`deep_${language}`];
      assert(Array.isArray(paragraphs) && paragraphs.length >= 2, `Missing ${language} analysis paragraphs`);
      assert.equal(paragraphs.length, story.deep_en.length, `Uneven analysis coverage in ${language}`);
      paragraphs.forEach(value => requireText(value, `${language} analysis paragraph`));
    }
    for (const section of data.sections) {
      for (const field of ['title', 'intro']) requireText(section[`${language}_${field}`], `${section.id} ${language} ${field}`);
      assert(section.cards.length > 0, `Missing ${section.id} cards`);
      for (const card of section.cards) {
        for (const field of ['title', 'summary', 'deep']) requireText(card[`${language}_${field}`], `${section.id} card ${language} ${field}`);
      }
    }
    for (const forecast of data.forecasts) {
      requireText(forecast[language], `${language} forecast`);
      for (const field of ['evidence', 'counter', 'trigger']) {
        const key = language === 'en' ? field : `${field}_${language}`;
        requireText(forecast[key], `${language} forecast ${field}`);
      }
    }
    const audit = language === 'en' ? data.audit : data[`audit_${language}`];
    assert.equal(audit.length, data.audit.length, `Uneven audit coverage in ${language}`);
    for (const row of audit) {
      assert.equal(row.length, 2);
      row.forEach(value => requireText(value, `${language} audit row`));
    }
    const counts = measure(data, language);
    assert.equal(data.counts[language], counts.full, `Stale ${language} full count`);
    assert.equal(data.counts[`${language}_short`], counts.short, `Stale ${language} short count`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {date, data} = readEdition(process.argv[2]);
  validateEdition(data);
  console.log(`Validated ${date}: 12 stories, six desks and complete EN/ML/IT coverage`);
}
