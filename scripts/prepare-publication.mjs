import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readEdition} from './edition.mjs';

const {date} = readEdition(process.argv[2]);
const audio = ['en', 'ml', 'it'].flatMap(language =>
  ['short', 'full'].map(mode => `audio/${date}/${language}-${mode}.mp3`));
for (const file of audio) {
  if (fs.statSync(file).size < 5000) throw Error(`Missing or too small: ${file}`);
  const info = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0', '-show_entries',
    'stream=codec_name:format=duration', '-of', 'json', file
  ], {encoding: 'utf8', timeout: 30000}));
  if (info.streams[0]?.codec_name !== 'mp3' || !(Number(info.format?.duration) > 1)) {
    throw Error(`Invalid MP3 recording: ${file}`);
  }
  execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:a:0', '-f', 'null', '-'],
    {timeout: 120000, stdio: 'inherit'});
}
const target = 'publication.json';
fs.writeFileSync(target + '.tmp', JSON.stringify({date, ready: true, audio}, null, 2) + '\n');
fs.renameSync(target + '.tmp', target);
console.log(`Publication manifest ready: ${date}`);
