// Usage: node i18n-apply.cjs <repoRoot> <locale> <doneFile.json>...
// Each done file has the same shape as a todo chunk, values translated. Writes values in place, key order and formatting style kept.
const fs = require('fs'); const path = require('path');
const [root, locale, ...files] = process.argv.slice(2);
const file = path.join(root, 'src/i18n/locales', `${locale}.json`);
const src = fs.readFileSync(file, 'utf8'); const data = JSON.parse(src);
const enData = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const tokens = (s) => (s.match(/\{\{[^}]+\}\}|<\/?[a-zA-Z0-9]+\s*\/?>|\$t\([^)]*\)/g) || []).sort().join('|');
let applied = 0, rejected = [];
for (const f of files) for (const [key, value] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')))) {
  const parts = key.split(' > '); let o = data, e = enData;
  for (const p of parts.slice(0, -1)) { o = o?.[p]; e = e?.[p]; }
  const last = parts[parts.length - 1];
  if (!o || typeof o[last] !== 'string' || typeof value !== 'string' || !value.trim()) { rejected.push(`${key}: missing`); continue; }
  if (tokens(value) !== tokens(e[last])) { rejected.push(`${key}: placeholder mismatch`); continue; }
  o[last] = value; applied++;
}
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const indent = (src.match(/\n( +)"/) || [, '  '])[1].length;
fs.writeFileSync(file, JSON.stringify(data, null, indent).replaceAll('\n', nl) + (src.endsWith('\n') ? nl : ''));
console.log(`${locale}: applied ${applied}, rejected ${rejected.length}`); rejected.slice(0, 30).forEach((r) => console.log('  ' + r));
