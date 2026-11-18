import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readEdition} from './edition.mjs';

const date = process.argv[2];
if (!date) throw Error('Usage: node scripts/prepare-edition.mjs YYYY-MM-DD');
const current = readEdition().date;
if (date < current) throw Error(`Cannot replace ${current} with older edition ${date}`);

const run = (...args) => execFileSync(process.execPath, args, {stdio: 'inherit'});
run('scripts/measure-edition.mjs', date, '--write');
run('scripts/validate-edition.mjs', date);
run('scripts/build-audio-scripts.mjs', date);

const pointer = 'editions/latest.js';
const pending = `${pointer}.${process.pid}.tmp`;
try {
  fs.writeFileSync(pending, `// Latest verified editorial edition; audio readiness is tracked separately.\ndocument.write('<script src="./editions/${date}.js"><\\/script>');\n`, {flag: 'wx'});
  fs.renameSync(pending, pointer);
} finally {
  fs.rmSync(pending, {force: true});
}
