"""Build one offline narration per language and mode with eSpeak NG and FFmpeg."""

from pathlib import Path
import subprocess
import sys
import tempfile
from datetime import date

VOICES = {"en": "en-gb", "ml": "ml", "it": "it"}


def main(edition):
    if date.fromisoformat(edition).isoformat() != edition:
        raise ValueError("Expected edition date YYYY-MM-DD")
    source = Path("audio/scripts") / edition
    target = Path("audio") / edition
    target.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(dir=target) as staging:
        work = Path(staging)
        for lang, voice in VOICES.items():
            for mode in ("short", "full"):
                name = f"{lang}-{mode}"
                script = source / f"{name}.txt"
                if len(script.read_text(encoding="utf-8").strip()) < 200:
                    raise ValueError(f"Narration too short: {name}")
                wave = work / "track.wav"
                subprocess.run(
                    ["espeak-ng", "-v", voice, "-s", "160", "-f", str(script), "-w", str(wave)],
                    check=True, timeout=120,
                )
                subprocess.run(
                    ["ffmpeg", "-v", "error", "-xerror", "-i", str(wave), "-ac", "1",
                     "-codec:a", "libmp3lame", "-b:a", "48k", str(work / f"{name}.mp3")],
                    check=True, timeout=120,
                )
                wave.unlink()
        for track in work.glob("*.mp3"):
            track.replace(target / track.name)


if __name__ == "__main__":
    main(sys.argv[1])
