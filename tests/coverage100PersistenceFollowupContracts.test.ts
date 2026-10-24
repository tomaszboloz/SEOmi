import { afterEach, expect, it, vi } from 'vitest';
import { parseCrawlConfig } from '@/services/crawlContracts';
import { filterAndSortCrawlLinks, type CrawlLinkRecord } from '@/services/crawlLinkFilters';
import { buildCrawlerReadiness } from '@/services/crawlerReadiness';
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE, loadSelectedCrawlReportTemplateId,
} from '@/services/reportTemplates';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

it('rejects a partial crawl config whose merged required field is undefined', () => {
  expect(parseCrawlConfig({ includePatterns: undefined })).toBeNull();
});

it('supports the legacy blocked link filter', () => {
  const record: CrawlLinkRecord = {
    key: 'blocked', sourceUrl: 'https://source.test/',
    link: { target_url: 'https://target.test/', anchor_text: 'x', is_internal: true, target_http_status: 500 },
  };
  expect(filterAndSortCrawlLinks([record], {
    query: '', kind: 'all', status: 'blocked', sort: 'target', descending: false,
  })).toEqual([record]);
  expect(filterAndSortCrawlLinks([record], {
    query: '', kind: 'all', status: 'error', sort: 'target', descending: false,
  })).toEqual([]);
  expect(filterAndSortCrawlLinks([record], {
    query: '', kind: 'all', status: 'all', sort: 'target', descending: false,
  })).toEqual([record]);
});

it('preserves a null readiness score when no check is known', () => {
  const original = Array.prototype.filter;
  vi.spyOn(Array.prototype, 'filter').mockImplementation(function (this: unknown[], callback: any, thisArg?: any) {
    const first = this[0];
    if (this.length === 9 && first && typeof first === 'object' && 'evidenceKey' in first) return [];
    return original.call(this, callback, thisArg) as unknown[];
  } as typeof Array.prototype.filter);
  const report = buildCrawlerReadiness(createCrawlResultFixture({ pages: [createCrawlPageFixture()] }));
  expect(report).toMatchObject({ score: null, knownChecks: 0 });
});

it('uses the built-in selection when the stored id is empty but valid', () => {
  const originalId = DEFAULT_CRAWL_REPORT_TEMPLATE.id;
  DEFAULT_CRAWL_REPORT_TEMPLATE.id = '';
  try {
    localStorage.setItem('seomi_project_empty-template_report_template_selection_v1', '');
    expect(loadSelectedCrawlReportTemplateId('empty-template')).toBe('');
  } finally {
    DEFAULT_CRAWL_REPORT_TEMPLATE.id = originalId;
  }
});
