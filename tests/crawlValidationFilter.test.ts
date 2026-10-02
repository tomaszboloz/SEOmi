import { expect, it } from 'vitest';
import { filterValidationPages } from '@/components/Domain/crawlResults/crawlValidationFilter';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, findings?: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) =>
  ({ url, html_validation_findings: findings, ...extra }) as unknown as CrawledPageSummary;
const pages = [
  page('https://a.test/errors', [{ code: 'duplicate-id', severity: 'error', message: 'Duplicate id' }, { code: 'obsolete', severity: 'warning', message: 'Obsolete tag' }]),
  page('https://a.test/warnings', [{ code: 'obsolete', severity: 'warning', message: 'Obsolete tag' }]),
  page('https://a.test/clean', []),
  page('https://a.test/legacy'),
  page('https://a.test/charset', undefined, { detected_charset: 'windows-1250' }),
];
const urls = (result: ReturnType<typeof filterValidationPages>) => result.validationPages.map(item => item.page.url);

it('lists every page with validation evidence when no filter is active', () => {
  const result = filterValidationPages(pages, '', 'all');
  expect(result.checkedPages.map(item => item.url)).not.toContain('https://a.test/legacy');
  expect(urls(result)).toEqual(['https://a.test/errors', 'https://a.test/warnings', 'https://a.test/clean', 'https://a.test/charset']);
});

it('shows only pages with findings of the selected severity', () => {
  const result = filterValidationPages(pages, '', 'error');
  expect(urls(result)).toEqual(['https://a.test/errors']);
  expect(result.validationPages[0].findings.map(item => item.code)).toEqual(['duplicate-id']);
});

it('matches a query against page identity or finding text, case-insensitively', () => {
  expect(urls(filterValidationPages(pages, '  WINDOWS-1250 ', 'all'))).toEqual(['https://a.test/charset']);
  const byFinding = filterValidationPages(pages, 'duplicate', 'all');
  expect(urls(byFinding)).toEqual(['https://a.test/errors']);
  expect(byFinding.validationPages[0].findings.map(item => item.code)).toEqual(['duplicate-id']);
});

it('keeps every finding of a page whose URL matches, still filtered by severity', () => {
  const result = filterValidationPages(pages, '/errors', 'warning');
  expect(urls(result)).toEqual(['https://a.test/errors']);
  expect(result.validationPages[0].findings.map(item => item.code)).toEqual(['obsolete']);
});
