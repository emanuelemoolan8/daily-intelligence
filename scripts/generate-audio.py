from pathlib import Path
from gtts import gTTS
import sys
import re
edition = sys.argv[1] if len(sys.argv) > 1 else re.search(r'editions/(\d{4}-\d{2}-\d{2})\.js', Path('editions/latest.js').read_text()).group(1)
if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', edition):
    raise ValueError('Invalid edition date')
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
