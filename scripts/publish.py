#!/usr/bin/env python3
"""Research, validate, and archive a bilingual edition; fail closed on invalid output."""
import datetime as dt
import json
import os
import pathlib
import re
import sys
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROME = ZoneInfo('Europe/Rome')
now = dt.datetime.now(ROME)
date = now.date().isoformat()
required = ['Front Page', 'Major News Desk', 'Intelligence Desk', 'Markets, Local & Personal', 'Forward Desk', 'Editorial Audit']


def call_openai():
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        raise RuntimeError('OPENAI_API_KEY missing; no edition published')
    prompt = f'''Produce a sourced Daily Intelligence edition for {date}, cutoff {now.isoformat()}, focused on a reader in Sesto San Giovanni, Italy. Use live web search to verify CURRENT reporting and source URLs. Do not invent market values, weather, dates, or source URLs. Provide 8–12 DISTINCT consequential news stories distributed among six sections. Include practical original analysis, forecasts explicitly labelled, relevant market and local information only if verifiable, a forward-looking section with an advanced Linux edge/cloud OTA engineering insight, and an editorial audit. Avoid personal/private data. All six sections must appear in English and genuinely translated Malayalam. Each story must have at least one real https source URL; if verification is inadequate, say so in a story with a relevant source or FAIL instead of fabricating. The short brief should be meaningfully shorter than the full version. Return ONLY valid JSON using this exact schema: {{"date":"{date}","cutoff":"ISO timestamp", "translations":{{"en":{{"title":"...","intro":"...","disclosure":"AI-assisted, sources linked; independently check consequential claims","sections":[{{"heading":"Front Page","stories":[{{"title":"...","brief":"...","full":"...","sources":[{{"label":"publisher or report","url":"https://..."}}]}}]}}]}},"ml":{{"title":"...","intro":"...","disclosure":"...","sections":[{{"heading":"...","stories":[{{"title":"...","brief":"...","full":"...","sources":[{{"label":"...","url":"https://..."}}]}}]}}]}}}}}}. Exactly six sections in order: {', '.join(required)}. Malayalam sections must correspond to English in the same order. Aim for substantive coverage, not filler.'''
    payload = {'model': os.environ.get('OPENAI_MODEL', 'gpt-4.1'), 'tools': [{'type': 'web_search_preview'}], 'input': prompt, 'max_output_tokens': 16000}
    req = urllib.request.Request('https://api.openai.com/v1/responses', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=240) as resp:
        result = json.load(resp)
    parts = [c.get('text', '') for out in result.get('output', []) for c in out.get('content', []) if c.get('type') == 'output_text']
    text = '\n'.join(parts).strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*|\s*```$', '', text).strip()
    return json.loads(text)


def validate(obj):
    if obj.get('date') != date or not isinstance(obj.get('cutoff'), str):
        raise ValueError('Edition date/cutoff invalid')
    tr = obj.get('translations', {})
    if set(tr) != {'en', 'ml'}:
        raise ValueError('Both translations required')
    for lang in ('en', 'ml'):
        v = tr[lang]
        if not all(isinstance(v.get(k), str) and v[k].strip() for k in ('title', 'intro', 'disclosure')):
            raise ValueError('Missing translation metadata')
        sections = v.get('sections', [])
        if len(sections) != 6:
            raise ValueError('Six sections required')
        if lang == 'en' and [s.get('heading') for s in sections] != required:
            raise ValueError('English desk names/order invalid')
        for s in sections:
            if not s.get('heading') or not s.get('stories'):
                raise ValueError('Empty section')
            for story in s['stories']:
                if any(not isinstance(story.get(k), str) or len(story[k].strip()) < 15 for k in ('title', 'brief', 'full')):
                    raise ValueError('Missing story text')
                sources = story.get('sources', [])
                if not sources or any(not re.match(r'^https://[^\s]+$', x.get('url', '')) or not x.get('label') for x in sources):
                    raise ValueError('Story has no valid HTTPS source citation')
    news_count = sum(len(s['stories']) for s in tr['en']['sections'][:2])
    if news_count < 8 or news_count > 12:
        raise ValueError(f'Expected 8–12 front-page/major news items, got {news_count}')
    if [len(s['stories']) for s in tr['en']['sections']] != [len(s['stories']) for s in tr['ml']['sections']]:
        raise ValueError('Translation story counts mismatch')
    if not re.search('[\u0d00-\u0d7f]', json.dumps(tr['ml'], ensure_ascii=False)):
        raise ValueError('Malayalam script missing')


def main():
    if os.environ.get('SCHEDULED') == 'true' and now.hour != 8:
        print('Not 08:00 Europe/Rome; skipping UTC daylight-saving duplicate')
        return
    output = ROOT / 'editions' / f'{date}.json'
    if output.exists():
        print('Edition already exists; no overwrite')
        return
    obj = call_openai()
    validate(obj)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest_path = ROOT / 'editions/index.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest.insert(0, {'date': date, 'title': obj['translations']['en']['title'], 'file': output.name})
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Created {output.name}; {len(obj["translations"]["en"]["sections"])} sections')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Publication halted: {exc}', file=sys.stderr)
        sys.exit(1)
