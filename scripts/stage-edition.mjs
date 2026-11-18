import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readEdition} from './edition.mjs';
import {validateCandidate} from './validate-candidate.mjs';

const date = process.argv[2];
assert(date, 'Usage: node scripts/stage-edition.mjs YYYY-MM-DD');
const current = readEdition().date;
const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Rome'}).format(new Date());
assert(date > current && date <= today, `Expected an edition after ${current} and no later than ${today}`);
validateCandidate(date, readEdition(date).data);
fs.writeFileSync('editions/latest.js', `// Latest verified editorial edition.\ndocument.write('<script src="./editions/${date}.js"><\\/script>');\n`);
console.log(`Prepared ${date} on the local candidate branch. Verify it before promoting to main.`);
