#!/usr/bin/env python3
"""Generate background-playable neural speech MP3s from the published edition.
Uses the free, unofficial Edge speech endpoint: network access and continued
availability are not guaranteed. No paid API key is needed.
"""
import asyncio
import json
import re
from pathlib import Path
from html import unescape
import edge_tts

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
OUT = ROOT / "audio"
VOICES = {"en": "en-GB-SoniaNeural", "ml": "ml-IN-SobhanaNeural"}

def edition():
    match = re.search(r'<script[^>]*id="editionData"[^>]*>(.*?)</script>', HTML.read_text(encoding="utf-8"), re.S)
    if not match:
        raise RuntimeError("Published edition data missing from index.html")
    return json.loads(unescape(match.group(1)))

def paragraphs(data, language, depth):
    title = "Daily Intelligence. Today's newspaper." if language == "en" else "ഡെയ്‌ലി ഇന്റലിജൻസ്. ഇന്നത്തെ വാർത്തകൾ."
    yield title
    for story in data["stories"]:
        yield story[f"{language}_title"] + ". " + story[f"{language}_summary"]
        if depth == "full":
            yield from story.get("deep_en" if language == "en" else "deep_ml", [])

def chunks(parts, max_chars=1600):
    for part in parts:
        part = re.sub(r"\s+", " ", part).strip()
        if not part:
            continue
        while len(part) > max_chars:
            split = part.rfind(" ", 0, max_chars)
            if split < 200:
                split = max_chars
            yield part[:split].strip()
            part = part[split:].strip()
        if part:
            yield part

async def generate(language, depth, data):
    output = OUT / f"2026-10-24-{language}-{depth}.mp3"
    segments = list(chunks(paragraphs(data, language, depth)))
    temporary = output.with_suffix(".mp3.tmp")
    with temporary.open("wb") as destination:
        for i, part in enumerate(segments, 1):
            print(f"{language} {depth}: {i}/{len(segments)}", flush=True)
            # Each synthesis request produces MP3 frames. Concatenating streams
            # is supported by common browser decoders; verify actual playback.
            communicate = edge_tts.Communicate(part, VOICES[language], rate="-3%")
            found = False
            async for item in communicate.stream():
                if item["type"] == "audio":
                    destination.write(item["data"])
                    found = True
            if not found:
                raise RuntimeError(f"No audio returned for {language}/{depth} segment {i}")
    if temporary.stat().st_size < 1000:
        raise RuntimeError(f"Audio too small: {temporary}")
    temporary.replace(output)
    print(f"Generated {output.relative_to(ROOT)} ({output.stat().st_size} bytes)")

async def main():
    OUT.mkdir(exist_ok=True)
    data = edition()
    for language in ("en", "ml"):
        for depth in ("short", "full"):
            await generate(language, depth, data)

if __name__ == "__main__":
    asyncio.run(main())
