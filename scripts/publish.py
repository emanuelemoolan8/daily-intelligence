#!/usr/bin/env python3
"""Cost-conscious, staged Daily Intelligence publisher. No paid requests in dry-run."""
import datetime as dt
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(ZoneInfo("Europe/Rome"))
DATE = NOW.date().isoformat()
HEADINGS = ["Front Page", "Major News Desk", "Intelligence Desk",
            "Markets, Local & Personal", "Forward Desk", "Editorial Audit"]
KEYS = ["front", "major", "intelligence", "markets", "forward", "audit"]
CACHE = ROOT / ".cache" / DATE
DISCLOSURE = "AI-assisted reporting; check linked sources before relying on consequential claims."


def request(prompt, web=False):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY missing")
    model = os.environ.get("OPENAI_RESEARCH_MODEL" if web else "OPENAI_TRANSLATE_MODEL",
                           "gpt-4.1-mini")
    payload = {"model": model, "input": prompt, "max_output_tokens": 10000 if web else 14000,
               "text": {"format": {"type": "json_object"}}}
    if web:
        payload["tools"] = [{"type": "web_search_preview"}]
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            result = json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read(1200).decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI HTTP {exc.code}: {detail}") from None
    output = "\n".join(part.get("text", "") for item in result.get("output", [])
                       for part in item.get("content", []) if part.get("type") == "output_text")
    if not output.strip():
        raise ValueError("No model JSON output; response status: " + str(result.get("status")))
    return json.loads(output)


def check_story(story):
    if not isinstance(story, dict):
        raise ValueError("Invalid story object")
    for field in ("title", "brief", "full"):
        if not isinstance(story.get(field), str) or len(story[field].strip()) < 15:
            raise ValueError("Missing story " + field)
    sources = story.get("sources")
    if not isinstance(sources, list) or not sources:
        raise ValueError("Missing source")
    for source in sources:
        if not isinstance(source, dict) or not source.get("label") or not isinstance(source.get("url"), str) or not re.match(r"^https://[^\s]+$", source["url"]):
            raise ValueError("Invalid HTTPS source")


def check_english(data):
    if not isinstance(data, dict) or not isinstance(data.get("desks"), dict):
        raise ValueError("English desk object missing")
    for key in KEYS:
        stories = data["desks"].get(key)
        if not isinstance(stories, list) or not stories:
            raise ValueError("Missing English desk " + key)
        for story in stories:
            check_story(story)
    if len(data["desks"]["front"]) != 4 or len(data["desks"]["major"]) != 4:
        raise ValueError("Need exactly four stories in each news desk; got " +
                         str([len(data["desks"][k]) for k in ("front", "major")]))
    titles = [s["title"].strip().lower() for k in ("front", "major") for s in data["desks"][k]]
    if len(set(titles)) != len(titles):
        raise ValueError("Duplicate news headlines")


def research():
    prompt = f"""Research today's news as of {NOW.isoformat()} for a reader in Italy. Use live web search.
Return a JSON object ONLY, with keys title, intro, desks. desks MUST be an object with exactly
these keys: front, major, intelligence, markets, forward, audit.
front: EXACTLY 4 distinct important CURRENT verified news stories.
major: EXACTLY 4 OTHER distinct important CURRENT verified news stories.
intelligence, markets, forward, audit: at least ONE story each.
Each story is an object with title, brief, full, sources. sources is an array of objects
with label and url. Use real, specific, verified https source links; no fabricated URLs,
figures, quotes or unsupported assertions. brief: 1-2 sentences; full: 3-5 sentences.
Avoid filler. Focus on global developments and Italy; markets only when verifiable.
The forward desk should include practical Linux edge/cloud OTA architecture analysis.
Audit desk should discuss verification limitations with a real linked reference.
Do not use Markdown or code fences. Return JSON only. All text English.
IMPORTANT: desks is an OBJECT, not an array; do not omit any of its six named keys."""
    data = request(prompt, web=True)
    check_english(data)
    return data


def translate(data):
    source = {k: [{"title": s["title"], "brief": s["brief"], "full": s["full"]}
                  for s in data["desks"][k]] for k in KEYS}
    prompt = """Translate the following English newspaper content into natural, fluent Malayalam.
Return ONLY a JSON object with title, intro, desks.
desks MUST be an object with the same six keys and EXACTLY the same number of stories
per key, preserving story order. Each story must have title, brief, full strings.
Do not include sources; the publisher reuses the verified English source links.
Do not summarize, omit, add or fabricate stories. Use Malayalam script for all prose.
English content: """ + json.dumps({"title": data.get("title", "Daily Intelligence"),
                                     "intro": data.get("intro", "Today's sourced briefing"),
                                     "desks": source}, ensure_ascii=False)
    result = request(prompt)
    desks = result.get("desks", {})
    if not isinstance(desks, dict):
        raise ValueError("Translation desks missing")
    for key in KEYS:
        translated = desks.get(key)
        if not isinstance(translated, list) or len(translated) != len(data["desks"][key]):
            raise ValueError("Translation count mismatch in " + key)
        for story in translated:
            if not isinstance(story, dict) or any(not isinstance(story.get(f), str) or
               len(story[f].strip()) < 15 for f in ("title", "brief", "full")):
                raise ValueError("Incomplete translation in " + key)
            if not re.search("[\u0d00-\u0d7f]", story["title"] + story["brief"]):
                raise ValueError("Malayalam text missing in " + key)
    return result


def assemble(en, ml):
    translations = {}
    for lang, data in (("en", en), ("ml", ml)):
        sections = []
        for key, heading in zip(KEYS, HEADINGS):
            stories = []
            for i, story in enumerate(data["desks"][key]):
                original = en["desks"][key][i]
                stories.append({"title": story["title"], "brief": story["brief"],
                                "full": story["full"], "sources": original["sources"]})
            sections.append({"heading": heading if lang == "en" else {
                "front": "പ്രധാന വാർത്തകൾ", "major": "ലോക വാർത്തകൾ",
                "intelligence": "വിശകലനം", "markets": "വിപണിയും പ്രാദേശികവും",
                "forward": "ഭാവിയിലേക്ക്", "audit": "എഡിറ്റോറിയൽ പരിശോധന"}[key],
                             "stories": stories})
        translations[lang] = {"title": data.get("title") or "Daily Intelligence",
                              "intro": data.get("intro") or "Today's edition",
                              "disclosure": DISCLOSURE if lang == "en" else
                              "AI സഹായത്തോടെ തയ്യാറാക്കിയത്; പ്രധാന വിവരങ്ങൾ ഉറവിടങ്ങളിൽ പരിശോധിക്കുക.",
                              "sections": sections}
    return {"date": DATE, "cutoff": NOW.isoformat(), "translations": translations}


def main():
    if os.environ.get("SCHEDULED") == "true" and NOW.hour != 8:
        print("Outside 08:00 Europe/Rome; skipping duplicate schedule")
        return
    output = ROOT / "editions" / (DATE + ".json")
    if output.exists():
        print("Edition already exists; no paid API calls")
        return
    if os.environ.get("DRY_RUN") == "true":
        print("DRY_RUN passed: no paid API requests made")
        assert len(KEYS) == len(HEADINGS) == 6
        return
    CACHE.mkdir(parents=True, exist_ok=True)
    english_path = CACHE / "english.json"
    if english_path.exists():
        en = json.loads(english_path.read_text(encoding="utf-8"))
        check_english(en)
        print("Reusing validated English research cache; no research charge")
    else:
        en = research()
        english_path.write_text(json.dumps(en, ensure_ascii=False, indent=2), encoding="utf-8")
        print("English research validated and cached")
    malayalam_path = CACHE / "malayalam.json"
    if malayalam_path.exists():
        ml = json.loads(malayalam_path.read_text(encoding="utf-8"))
        print("Reusing Malayalam cache")
    else:
        ml = translate(en)
        malayalam_path.write_text(json.dumps(ml, ensure_ascii=False, indent=2), encoding="utf-8")
    edition = assemble(en, ml)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(edition, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest_path = ROOT / "editions" / "index.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest = [entry for entry in manifest if entry.get("date") != DATE or entry.get("file") == "demo.json"]
    manifest.insert(0, {"date": DATE, "title": edition["translations"]["en"]["title"],
                        "file": output.name})
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")
    print("Published " + output.name)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Publication halted: " + str(exc), file=sys.stderr)
        sys.exit(1)
