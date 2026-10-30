// Native review checklist for one locale (#109) and its AIO-R word lists (#108).
// Usage: node scripts/locale-review.mts <locale> [--prefix trust.] [--flagged] [--out-dir dir]
// Writes <locale>-strings.md and <locale>-aio-rules.md; it never marks anything as reviewed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { aioRulesChecklistMarkdown, reviewChecklistMarkdown, reviewItems } from '../src/services/localeReview/checklist.ts';

const args = process.argv.slice(2);
const locale = args[0];
const option = (name: string): string | undefined => { const index = args.indexOf(name); return index > 0 ? args[index + 1] : undefined; };
const LOCALES = join(import.meta.dirname, '..', 'src', 'i18n', 'locales');

if (!locale || locale.startsWith('--')) {
  console.error('Usage: node scripts/locale-review.mts <locale> [--prefix trust.] [--flagged] [--out-dir dir]');
  process.exitCode = 2;
} else {
  const read = (code: string): unknown => JSON.parse(readFileSync(join(LOCALES, `${code}.json`), 'utf8'));
  const generatedAt = new Date().toISOString();
  const prefix = option('--prefix') ?? '';
  const outDir = option('--out-dir') ?? join('locale-review');
  const items = reviewItems(read('en'), read(locale), prefix);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${locale}-strings.md`), reviewChecklistMarkdown(items, { locale, prefix, generatedAt, flaggedOnly: args.includes('--flagged') }));
  writeFileSync(join(outDir, `${locale}-aio-rules.md`), aioRulesChecklistMarkdown(locale, generatedAt));
  console.log(`${locale}: ${items.length} strings, ${items.filter((item) => item.flags.length).length} with hints -> ${outDir}`);
}
