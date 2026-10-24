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

def spoken(text):
    """Keep source facts unchanged while making narration easier to follow."""
    text = re.sub(r"\\s+", " ", str(text)).strip()
    return text

def paragraphs(data, language, depth):
    """Conversational framing; facts come only from the published edition."""
    if language == "ml":
        yield "നമസ്കാരം. ഡെയ്‌ലി ഇന്റലിജൻസിലേക്ക് സ്വാഗതം. ഇന്നത്തെ പ്രധാന വാർത്തകൾ നമുക്ക് ലളിതമായി നോക്കാം."
        lead = ["ആദ്യം ഒരു പ്രധാന വാർത്ത.", "ഇനി മറ്റൊരു വാർത്ത നോക്കാം.", "അടുത്തതായി എന്താണ് സംഭവിച്ചതെന്ന് നോക്കാം.", "ഇനി ശ്രദ്ധിക്കേണ്ട മറ്റൊരു കാര്യം.", "അടുത്ത വാർത്തയിലേക്ക് പോകാം."]
        detail = "ഇനി ഇതിനെക്കുറിച്ച് കുറച്ചുകൂടി വിശദമായി നോക്കാം."
        ending = "ഇന്നത്തെ പ്രധാന വാർത്തകൾ ഇത്രയുമാണ്. കേട്ടതിന് നന്ദി. വീണ്ടും കാണാം."
    else:
        yield "Hello, and welcome to Daily Intelligence. Let's catch up on today's news, one story at a time."
        lead = ["First, here's an important story.", "Now, let's look at another development.", "Here's what else is happening.", "Another story worth understanding.", "Let's move to the next story."]
        detail = "Let's look at the details and why they matter."
        ending = "That's our news roundup for today. Thanks for listening, and see you next time."
    stories = data.get("stories", [])
    for i, story in enumerate(stories):
        yield lead[min(i, len(lead)-1)] if i < len(lead) else lead[i % len(lead)]
        yield spoken(story[f"{language}_title"]) + ". " + spoken(story[f"{language}_summary"])
        if depth == "full":
            details = story.get("deep_en" if language == "en" else "deep_ml", [])
            if isinstance(details, str):
                details = [details]
            if details:
                yield detail
                for paragraph in details:
                    if spoken(paragraph):
                        yield spoken(paragraph)
    yield ending

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
    output = OUT / f"{data.get('edition_date', '2026-10-24')}-{language}-{depth}.mp3"
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
