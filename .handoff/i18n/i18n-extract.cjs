// Usage: node i18n-extract.cjs <repoRoot> <locale> <outDir>
// Writes <outDir>/<locale>-todo-NN.json chunks (300 keys each): { "flat.key": "English text" } for strings identical to English.
const fs = require('fs'); const path = require('path');
const [root, locale, outDir] = process.argv.slice(2);
const flat = (o, p = '', r = {}) => { for (const [k, v] of Object.entries(o)) { const q = p ? `${p}\u0000${k}` : k; if (v && typeof v === 'object') flat(v, q, r); else r[q] = v; } return r; };
const read = (l) => flat(JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales', `${l}.json`), 'utf8')));
const en = read('en'); const loc = read(locale);
const todo = Object.keys(en).filter((k) => typeof en[k] === 'string' && loc[k] === en[k] && /\p{L}{2,}/u.test(en[k]));
fs.mkdirSync(outDir, { recursive: true });
for (let i = 0; i < todo.length; i += 300) {
  const chunk = Object.fromEntries(todo.slice(i, i + 300).map((k) => [k.split('\u0000').join(' > '), en[k]]));
  fs.writeFileSync(path.join(outDir, `${locale}-todo-${String(i / 300).padStart(2, '0')}.json`), JSON.stringify(chunk, null, 1));
}
console.log(`${locale}: ${todo.length} keys in ${Math.ceil(todo.length / 300)} chunks`);
