"""Exercise recovery without calling the speech service or waiting for retries."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace

from gtts import gTTSError

spec = importlib.util.spec_from_file_location('audio_generator', Path(__file__).resolve().parents[1] / 'scripts/generate-audio.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)


def error(status):
    return gTTSError(msg='test service failure', response=SimpleNamespace(status_code=status))


class AudioRecovery(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.dest = self.root / 'en-full.mp3'
        self.cache = self.root / 'cache'
        self.sleeps = []

    def tearDown(self):
        self.temp.cleanup()

    def run_audio(self, factory, text='hello world ' * 30, **kwargs):
        audio.generate_recording(text, 'en', self.dest, self.cache,
                                 factory=factory, sleep=self.sleeps.append,
                                 assemble=lambda parts, dest: dest.write_bytes(b''.join(p.read_bytes() for p in parts)), **kwargs)

    def test_rate_limit_discards_partial_attempt_then_recovers(self):
        calls = []
        def factory(**kwargs):
            calls.append(kwargs)
            def stream():
                if len(calls) == 1:
                    yield b'partial'
                    raise error(429)
                yield b'a' * 6000
            return SimpleNamespace(stream=stream)
        self.run_audio(factory)
        self.assertEqual(self.dest.read_bytes(), b'a' * 6000)
        self.assertIn(30, self.sleeps)
        self.assertEqual(calls[0]['timeout'], (10, 30))
        self.assertFalse(list(self.root.rglob('*.part')))

    def test_retry_exhaustion_preserves_previous_recording(self):
        self.dest.write_bytes(b'old verified recording')
        calls = []
        def factory(**kwargs):
            calls.append(kwargs)
            raise error(429)
        with self.assertRaises(gTTSError):
            self.run_audio(factory, delays=(1, 2))
        self.assertEqual(len(calls), 3)
        self.assertEqual(self.sleeps, [1, 2])
        self.assertEqual(self.dest.read_bytes(), b'old verified recording')
        self.assertFalse(list(self.root.rglob('*.part')))

    def test_permanent_error_is_not_retried(self):
        def factory(**kwargs):
            raise error(403)
        with self.assertRaises(gTTSError):
            self.run_audio(factory)
        self.assertEqual(self.sleeps, [])

    def test_rerun_resumes_completed_chunks_and_changed_text_is_not_reused(self):
        text = 'first ' * 150 + 'second ' * 150
        first_chunk = next(audio.split_text(text))
        calls = []
        def interrupted(**kwargs):
            calls.append(kwargs['text'])
            if kwargs['text'] != first_chunk:
                raise error(429)
            return SimpleNamespace(stream=lambda: iter([b'a' * 6000]))
        with self.assertRaises(gTTSError):
            self.run_audio(interrupted, text=text, delays=())
        self.assertFalse(self.dest.exists())
        calls.clear()
        def recovered(**kwargs):
            calls.append(kwargs['text'])
            return SimpleNamespace(stream=lambda: iter([b'b' * 6000]))
        self.run_audio(recovered, text=text)
        self.assertNotIn(first_chunk, calls)
        self.assertEqual(self.dest.read_bytes(), b'a' * 6000 + b'b' * 6000)
        self.run_audio(recovered, text='new narration ' * 30)
        self.assertIn('new narration', calls[-1])

    def test_deadline_stops_before_retry_wait(self):
        def factory(**kwargs):
            raise error(429)
        with self.assertRaises(TimeoutError):
            self.run_audio(factory, clock=lambda: 10, deadline=20)
        self.assertEqual(self.sleeps, [])

    def test_split_preserves_all_words_including_malayalam(self):
        text = ('ഇന്നത്തെ വാർത്തകൾ കൂടുതൽ വിശദമായി വായിക്കാം.\n' * 100).strip()
        self.assertEqual(' '.join(audio.split_text(text)).split(), text.split())


if __name__ == '__main__':
    unittest.main()
