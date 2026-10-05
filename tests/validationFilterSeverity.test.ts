import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useValidationFilter } from '@/components/Domain/crawlResults/validationTab/useValidationFilter';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, findings?: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) =>
  ({ url, html_validation_findings: findings, ...extra }) as unknown as CrawledPageSummary;
const pages = [
  page('https://a.test/errors', [{ code: 'duplicate-id', severity: 'Error', message: 'Duplicate id' }, { code: 'obsolete', severity: 'Warning', message: 'Obsolete tag' }]),
  page('https://a.test/warnings', [{ code: 'obsolete', severity: 'Warning', message: 'Obsolete tag' }]),
  page('https://a.test/clean', []),
  page('https://a.test/legacy'),
  page('https://a.test/charset', undefined, { detected_charset: 'windows-1250' }),
];
const run = (query: string, severity: 'all' | 'Error' | 'Warning') => renderHook(() => useValidationFilter(pages, query, severity)).result.current;
const urls = (result: ReturnType<typeof run>) => result.validationPages.map(item => item.page.url);

it('lists every page with validation evidence when no filter is active', () => {
  const result = run('', 'all');
  expect(result.checkedPages.map(item => item.url)).not.toContain('https://a.test/legacy');
  expect(urls(result)).toEqual(['https://a.test/errors', 'https://a.test/warnings', 'https://a.test/clean', 'https://a.test/charset']);
  expect(result.validationFindingCount).toBe(3);
});

it('shows only pages with findings of the selected severity', () => {
  const result = run('', 'Error');
  expect(urls(result)).toEqual(['https://a.test/errors']);
  expect(result.validationPages[0].findings.map(item => item.code)).toEqual(['duplicate-id']);
  expect(result.validationFindingCount).toBe(1);
});

it('matches a query against page identity or finding text, case-insensitively', () => {
  expect(urls(run('  WINDOWS-1250 ', 'all'))).toEqual(['https://a.test/charset']);
  const byFinding = run('duplicate', 'all');
  expect(urls(byFinding)).toEqual(['https://a.test/errors']);
  expect(byFinding.validationPages[0].findings.map(item => item.code)).toEqual(['duplicate-id']);
});

it('keeps a page whose URL matches the query, still filtered by severity', () => {
  const result = run('/errors', 'Warning');
  expect(urls(result)).toEqual(['https://a.test/errors']);
  expect(result.validationPages[0].findings.map(item => item.code)).toEqual(['obsolete']);
});
