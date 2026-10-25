from pathlib import Path
from gtts import gTTS
import sys
edition = '2026-10-25'
source = Path('audio/scripts') / edition
output = Path('audio') / edition
output.mkdir(parents=True, exist_ok=True)
for lang in ('en','ml','it'):
    for depth in ('short','full'):
        text = (source / f'{lang}-{depth}.txt').read_text(encoding='utf-8').strip()
        if len(text) < 200:
            raise ValueError(f'Narration too short: {lang}-{depth}')
        dest = output / f'{lang}-{depth}.mp3'
        print(f'Generating {dest} ({len(text)} chars)', flush=True)
        gTTS(text=text, lang=lang, slow=False, lang_check=True).save(str(dest))
        if dest.stat().st_size < 5000:
            raise ValueError(f'MP3 unexpectedly small: {dest}')
print('Six recordings generated and size-checked',flush=True)
