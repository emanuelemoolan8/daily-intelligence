#!/usr/bin/env python3
"""Build offline MP3 narration from the embedded newspaper JSON; no paid API."""
import json, pathlib, re, subprocess, sys, html as htmlmod
root=pathlib.Path(__file__).resolve().parent.parent
edition=root/"daily_intelligence_2026-10-24_bilingual_listen.html"
page=edition.read_text(encoding="utf-8")
match=re.search(r'<script id="editionData" type="application/json">(.*?)</script>',page,re.S)
if not match: raise SystemExit("Edition JSON missing")
d=json.loads(match.group(1))
out=root/"audio";out.mkdir(exist_ok=True)
def clean(x):
    return re.sub(r"\s+"," ",htmlmod.unescape(re.sub(r"<[^>]+>"," ",str(x or "")))).strip()
def narration(lang,depth):
    ml=lang=="ml"
    key=lambda a,b:b if ml else a
    chunks=[key("Daily Intelligence. 24 October 2026. Here is what matters today.","ഡെയിലി ഇന്റലിജൻസ്. 2026 ഒക്ടോബർ 24. ഇന്നത്തെ പ്രധാന വാർത്തകൾ.")]
    for s in d["stories"]:
        chunks.extend([s[key("en_title","ml_title")],s[key("en_summary","ml_summary")]])
        if depth=="full":
            chunks.extend(s[key("deep_en","deep_ml")])
            chunks.extend([s[key("context_en","context_ml")],s[key("watch_en","watch_ml")]])
    for section in d["sections"]:
        chunks.extend([section[key("en_title","ml_title")],section[key("en_intro","ml_intro")]])
        for c in section["cards"]:
            chunks.extend([c[key("en_title","ml_title")],c[key("en_summary","ml_summary")]])
            if depth=="full":chunks.append(c[key("en_deep","ml_deep")])
    if depth=="full":
        for f in d["forecasts"]:
            chunks.extend([f[key("en","ml")],f.get("deadline",""),f.get(key("evidence","evidence_ml"),"")])
    return "\n\n".join(filter(None,(clean(c) for c in chunks)))
for lang in ("en","ml"):
    for depth in ("short","full"):
        text=narration(lang,depth)
        target=out/f"2026-10-24-{lang}-{depth}.mp3"
        voice="en-gb" if lang=="en" else "ml"
        tts=subprocess.Popen(["espeak-ng","-v",voice,"-s","142","--stdout"],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        encoder=subprocess.Popen(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y","-f","wav","-i","pipe:0","-ac","1","-ar","22050","-b:a","40k",str(target)],stdin=tts.stdout,stderr=subprocess.PIPE)
        tts.stdout.close()
        tts.stdin.write(text.encode("utf-8"));tts.stdin.close()
        err=encoder.communicate()[1]
        if encoder.returncode:raise SystemExit(f"Encoding failed {target}: {err.decode(errors='replace')}")
        print(f"{target.relative_to(root)} {target.stat().st_size} bytes")
