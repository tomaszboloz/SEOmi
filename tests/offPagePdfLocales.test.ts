import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';

const languages = ['en', 'pl', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'ar', 'ja', 'ko', 'zh'];
const flatten = (value: unknown): string[] => typeof value === 'string' ? [value] : Object.values(value as object).flatMap(flatten);

it.each(languages)('translates all off-page PDF labels and the template checkbox in %s with canonical JSON formatting', (language) => {
  const raw = readFileSync(`src/i18n/locales/${language}.json`, 'utf8');
  const locale = JSON.parse(raw) as typeof en;
  expect(raw).toBe(`${JSON.stringify(locale, null, 2)}\n`);
  expect(Object.keys(locale.pdfReport.crawl.offPage).sort()).toEqual(Object.keys(en.pdfReport.crawl.offPage).sort());
  expect(flatten(locale.pdfReport.crawl.offPage).every((text) => text.trim().length > 0)).toBe(true);
  expect(locale.siteAudit.reportSections.offPage).toBe(locale.pdfReport.crawl.offPage.title);
  expect(locale.pdfReport.crawl.offPage.status).toEqual(locale.offPageSourcesUi.history.status);
  expect(locale.pdfReport.crawl.offPage.limitations).toEqual(locale.offPageSourcesUi.limitations);
});
