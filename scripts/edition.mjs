import fs from 'node:fs';

export function readEdition(date) {
  if (!date) {
    const pointer = fs.readFileSync('editions/latest.js', 'utf8');
    date = pointer.match(/editions\/(\d{4}-\d{2}-\d{2})\.js/)?.[1];
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw Error('Expected edition date YYYY-MM-DD');
  const source = fs.readFileSync(`editions/${date}.js`, 'utf8');
  const payload = source.match(/^\s*window\.DI_EDITION_DATA\s*=\s*([\s\S]+?)\s*;?\s*$/)?.[1];
  if (!payload) throw Error('Expected window.DI_EDITION_DATA JSON assignment');
  const data = JSON.parse(payload);
  if (data.date !== date) throw Error('Edition metadata date does not match filename');
  return {date, data};
}
