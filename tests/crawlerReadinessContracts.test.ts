import { expect, it } from 'vitest';
import { buildCrawlerReadiness } from '@/services/crawlerReadiness';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import type { CrawledPageSummary, SiteCrawlResult } from '@/types';

const page = (patch: Partial<CrawledPageSummary> = {}) => createCrawlPageFixture({
  title: 'Title', meta_description: 'Description', canonical: 'https://example.test',
  word_count: 100, document_language: 'pl', semantic_terms: ['audit'], schema_types: ['WebPage'], ...patch,
});
const report = (pages: CrawledPageSummary[], patch: Partial<SiteCrawlResult> = {}) => buildCrawlerReadiness(createCrawlResultFixture({ pages, robots_txt_status: 'available', ...patch }));
const check = (pages: CrawledPageSummary[], id: string, patch: Partial<SiteCrawlResult> = {}) => report(pages, patch).checks.find((value) => value.id === id)!;

it('counts affected metadata pages once even when several fields are missing', () => {
  const value = check([page({ meta_description: '', canonical: '' }), page({ meta_description: '', canonical: '' })], 'metadata');
  expect(value.status).toBe('warning');
  expect(value.affectedPages).toBe(2);
  expect(value.totalPages).toBe(2);
});

it('does not treat HTTP zero without a response as healthy', () => {
  expect(check([page({ http_status: 0 })], 'http-response')).toMatchObject({ status: 'error', affectedPages: 1 });
});

it.each([[200, 'pass'], [299, 'pass'], [300, 'warning'], [399, 'warning'], [400, 'error']] as const)('classifies observed HTTP %i', (http_status, status) => {
  expect(check([page({ http_status })], 'http-response').status).toBe(status);
});

it('returns unknown for an empty run and preserves no invented score', () => {
  expect(report([])).toMatchObject({ score: null, checks: [], knownChecks: 0, totalPages: 0, limitationKeys: ['emptyRun'] });
});

it.each([['', 'unknown'], ['unrecognized', 'unknown'], ['noindex', 'error'], ['indexable', 'pass']] as const)('classifies indexability %s', (indexability_status, status) => {
  expect(check([page({ indexability_status })], 'indexability').status).toBe(status);
});

it('marks partial indexability and semantic observations as uncertain', () => {
  const pages = [page(), page({ indexability_status: '', semantic_terms: [] })];
  expect(check(pages, 'indexability')).toMatchObject({ status: 'warning', affectedPages: 1 });
  expect(check(pages, 'content-semantics')).toMatchObject({ status: 'warning', affectedPages: 1 });
  expect(check([page({ semantic_terms: undefined })], 'content-semantics').status).toBe('unknown');
});

it('prioritizes robots exclusions but keeps unavailable retrieval unknown', () => {
  expect(check([page()], 'robots', { robots_blocked_count: 1, robots_txt_status: 'unavailable' }).status).toBe('warning');
  expect(check([page()], 'robots', { robots_txt_status: 'error' }).status).toBe('unknown');
});

it('does not pass robots when the crawler reports that the file was not evaluated', () => {
  for (const status of ['robots.txt returned HTTP 503 Service Unavailable; URLs allowed', 'robots.txt returned HTTP 429 Too Many Requests; URLs allowed', 'robots.txt returned HTTP 301 Moved Permanently; URLs allowed', 'robots.txt could not be read (response too large); URLs allowed', 'robots.txt unavailable (timeout); URLs allowed']) {
    expect(check([page()], 'robots', { robots_txt_status: status }).status, status).toBe('unknown');
  }
  for (const status of ['Loaded 12 applicable robots.txt rules', 'robots.txt not found; URLs allowed']) {
    expect(check([page()], 'robots', { robots_txt_status: status }).status, status).toBe('pass');
  }
});

it('distinguishes missing content, truncation, language and schema evidence', () => {
  expect(check([page({ word_count: 0 })], 'content').status).toBe('error');
  expect(check([page({ body_truncated: true })], 'content').status).toBe('warning');
  expect(check([page({ document_language: ' ' })], 'language-accessibility').status).toBe('warning');
  expect(check([page({ schema_types: [] })], 'structured-data').status).toBe('unknown');
  expect(check([page({ schema_syntax_errors: 1 })], 'structured-data').status).toBe('error');
});

it('reports local rendered observation separately from the HTTP snapshot', () => {
  expect(check([page()], 'rendered-dom').status).toBe('unknown');
  expect(check([page()], 'rendered-dom', { crawl_mode: 'browser-rendered' }).status).toBe('pass');
  expect(report([page()], { crawl_mode: 'browser-rendered' })).toMatchObject({ score: 100, knownChecks: 9, totalPages: 1 });
});
