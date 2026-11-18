import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ESpeakNg from 'espeak-ng';
import {readEdition} from './edition.mjs';

const {date} = readEdition(process.argv[2]);
const scripts = path.join('audio', 'scripts', date);
const target = path.join('audio', date);
const voices = {en: 'en-gb', ml: 'ml', it: 'it'};
fs.mkdirSync(target, {recursive: true});
const staging = fs.mkdtempSync(path.join(target, '.staging-'));

try {
  for (const [lang, voice] of Object.entries(voices)) {
    for (const mode of ['short', 'full']) {
      const name = `${lang}-${mode}`;
      const text = fs.readFileSync(path.join(scripts, name + '.txt'), 'utf8').trim();
      assert(text.length >= 200, `Narration too short: ${name}`);
      const wave = path.join(staging, 'speech.wav');
      const synth = await ESpeakNg({
        arguments: ['-v', voice, '-s', '160', '-f', 'narration.txt', '-w', 'speech.wav'],
        preRun: [module => module.FS.writeFile('narration.txt', text)],
      });
      fs.writeFileSync(wave, synth.FS.readFile('speech.wav'));
      execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', wave, '-ac', '1',
        '-codec:a', 'libmp3lame', '-b:a', '48k', path.join(staging, name + '.mp3')],
      {timeout: 120000, stdio: 'inherit'});
      fs.unlinkSync(wave);
    }
  }
  for (const recording of fs.readdirSync(staging)) {
    fs.renameSync(path.join(staging, recording), path.join(target, recording));
  }
} finally {
  fs.rmSync(staging, {recursive: true, force: true});
}
