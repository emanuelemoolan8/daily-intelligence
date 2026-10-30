"""Generate recordings with bounded, paced requests and resumable text chunks."""
from pathlib import Path
import hashlib
import re
import sys
import time
import subprocess
import tempfile


def split_text(text, limit=1000):
    words = text.split()
    chunk, length = [], 0
    for word in words:
        if chunk and length + len(word) + 1 > limit:
            yield ' '.join(chunk)
            chunk, length = [], 0
        chunk.append(word)
        length += len(word) + 1
    if chunk:
        yield ' '.join(chunk)


def assemble_mp3(parts, destination):
    # The concat demuxer reads each MP3 header separately; raw concatenation can
    # leave ID3/Xing headers in the middle of a recording and cause decode errors.
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', encoding='utf-8') as listing:
        for part in parts:
            escaped = str(part.resolve()).replace("'", "'\\''")
            listing.write(f"file '{escaped}'\n")
        listing.flush()
        subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-y', '-f', 'concat',
                        '-safe', '0', '-i', listing.name, '-codec:a', 'libmp3lame',
                        '-q:a', '2', '-f', 'mp3', str(destination)], check=True, timeout=120)


def generate_recording(text, lang, dest, cache, *, factory=None, sleep=time.sleep,
                       assemble=assemble_mp3,
                       clock=time.monotonic, deadline=None, delays=(30, 60, 120, 240)):
    from gtts import gTTS, gTTSError
    factory = factory or gTTS
    cache.mkdir(parents=True, exist_ok=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    pending = dest.with_suffix('.mp3.part')

    def check_deadline():
        if deadline is not None and clock() >= deadline:
            raise TimeoutError('Audio generation time budget exhausted; cached chunks retained')

    try:
        parts = []
        for text_chunk in split_text(text):
            check_deadline()
            key = hashlib.sha256(('gtts-2.5.4-v1\0' + lang + '\0' + text_chunk).encode()).hexdigest()
            part = cache / (key + '.mp3')
            if not part.exists() or part.stat().st_size < 100:
                temporary = part.with_suffix('.part')
                for attempt in range(len(delays) + 1):
                    check_deadline()
                    try:
                        with temporary.open('wb') as output:
                            speech = factory(text=text_chunk, lang=lang, slow=False,
                                             lang_check=True, timeout=(10, 30))
                            for audio in speech.stream():
                                check_deadline()
                                output.write(audio)
                                sleep(0.5)
                        if temporary.stat().st_size < 100:
                            raise ValueError('Speech service returned an empty or tiny chunk')
                        temporary.replace(part)
                        break
                    except gTTSError as error:
                        status = getattr(getattr(error, 'rsp', None), 'status_code', None)
                        if (status is not None and status != 429 and status < 500) or attempt == len(delays):
                            raise
                        delay = delays[attempt]
                        if deadline is not None and clock() + delay >= deadline:
                            raise TimeoutError('Insufficient time for audio retry; cached chunks retained') from error
                        print(f'{lang}: speech request failed (HTTP {status}); retry {attempt + 1}/{len(delays)} in {delay}s', flush=True)
                        sleep(delay)
                    finally:
                        temporary.unlink(missing_ok=True)
            parts.append(part)
        assemble(parts, pending)
        if pending.stat().st_size < 5000:
            raise ValueError(f'MP3 unexpectedly small: {dest}')
        pending.replace(dest)
    finally:
        pending.unlink(missing_ok=True)


def main():
    match = re.search(r'editions/(\d{4}-\d{2}-\d{2})\.js', Path('editions/latest.js').read_text())
    edition = sys.argv[1] if len(sys.argv) > 1 else match.group(1) if match else ''
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', edition):
        raise ValueError('Invalid edition date')
    source = Path('audio/scripts') / edition
    output = Path('audio') / edition
    deadline = time.monotonic() + 40 * 60
    for lang in ('en', 'ml', 'it'):
        for depth in ('short', 'full'):
            text = (source / f'{lang}-{depth}.txt').read_text(encoding='utf-8').strip()
            if len(text) < 200:
                raise ValueError(f'Narration too short: {lang}-{depth}')
            dest = output / f'{lang}-{depth}.mp3'
            print(f'Generating {dest} ({len(text)} chars)', flush=True)
            generate_recording(text, lang, dest, Path('audio/.tts-cache'), deadline=deadline)
    print('Six recordings generated and size-checked', flush=True)


if __name__ == '__main__':
    main()
