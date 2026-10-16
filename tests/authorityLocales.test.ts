import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUADRANTS_FOR_TEST } from './authorityLocaleFixtures';
import { locales } from './fixtures/i18nContracts';

const ROOTS = ['src/components/Domain/crawlResults/authority', 'src/services/topicalAuthority', 'src/services/topicalAuthorityMonitoring', 'src/services/topicalAuthorityReference'];
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
});

const read = (data: unknown, path: string): unknown => path.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), data);

const staticKeys = (): string[] => {
  const keys = new Set<string>();
  ROOTS.flatMap(walk).forEach((file) => {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\b(?:t|i18n\.t)\(\s*['`]((?:authority|authorityMonitoring)\.[A-Za-z0-9_.-]+)['`]/g)) keys.add(match[1]);
    for (const match of text.matchAll(/id="(authority\.[a-z]+)"/g)) keys.add(`help.${match[1]}.title`);
  });
  return [...keys];
};

const DYNAMIC = [
  ...QUADRANTS_FOR_TEST.flatMap((code) => [`authority.quadrant.${code}`, `authority.quadrantHint.${code}`]),
  ...['empty-authority', 'template-duplicates', 'no-dates', 'no-links', 'no-pillars'].map((code) => `authority.warning.${code}`),
  ...['serp', 'crawl', 'build'].map((phase) => `authority.reference.progress.${phase}`),
  ...['no-serp-source', 'no-queries', 'serp-failed', 'no-competitors', 'no-pages', 'no-taxonomy'].map((reason) => `authority.reference.unavailable.${reason}`),
  ...['all', 'gaps', 'shallow', 'cannibalized'].map((name) => `authority.coverage.filter.${name}`),
  ...['covered_strong', 'covered_shallow', 'missing_gap', 'cannibalized'].map((name) => `authority.coverage.status.${name}`),
  ...['critical', 'high', 'medium'].map((name) => `authority.coverage.gap.${name}`),
  ...['fill-gaps', 'merge-cannibalized', 'fix-linking', 'deepen-shallow', 'refresh-stale'].flatMap((code) => [`authority.rec.${code}`, `authority.rec.how.${code}`]),
  ...['rank', 'lead-pillar', 'trailing-pillars'].map((code) => `authority.benchmark.insight.${code}`),
  ...['cleanup', 'architecture', 'expansion', 'regression'].map((code) => `authority.history.${code}`),
  ...['tas-drop', 'cannibalization', 'competitor-expansion', 'content-decay'].map((code) => `authorityMonitoring.alert.${code}`),
  ...['tas', 'tcr', 'esd', 'scs', 'matrix', 'cannibalization'].flatMap((id) => ['title', 'what', 'why', 'action'].map((field) => `help.authority.${id}.${field}`)),
  'crawl.tabs.authority', 'siteAudit.reportSections.authority', 'authority.pillars.tcr', 'authority.pillars.cdes', 'authority.pillars.silc', 'authority.pillars.cvff',
];

describe('authority locale keys', () => {
  const keys = [...new Set([...staticKeys(), ...DYNAMIC])];

  it('finds the keys the sources use', () => {
    expect(keys.length).toBeGreaterThan(120);
  });

  it.each(locales)('has every authority key, non-empty, in $code', ({ data }) => {
    const missing = keys.filter((key) => { const value = read(data, key); return typeof value !== 'string' || !value.trim(); });
    expect(missing).toEqual([]);
  });

  it('keeps interpolation placeholders identical to English in every language', () => {
    const english = locales.find((item) => item.code === 'en')!.data;
    const placeholders = (text: unknown): string => (String(text).match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort().join(',');
    const bad = locales.flatMap(({ code, data }) => keys.filter((key) => placeholders(read(data, key)) !== placeholders(read(english, key))).map((key) => `${code}:${key}`));
    expect(bad).toEqual([]);
  });

  it('translates the PDF section labels into every language', () => {
    const base = read(locales.find((item) => item.code === 'en')!.data, 'pdfReport.crawl.authority') as Record<string, unknown>;
    const flat = (node: unknown, prefix = ''): string[] => (node && typeof node === 'object' ? Object.entries(node as Record<string, unknown>).flatMap(([name, value]) => flat(value, `${prefix}${name}.`)) : [prefix.slice(0, -1)]);
    const paths = flat(base);
    expect(paths.length).toBeGreaterThan(35);
    locales.forEach(({ code, data }) => {
      const section = read(data, 'pdfReport.crawl.authority');
      expect(flat(section).sort(), code).toEqual(paths.sort());
    });
  });
});
