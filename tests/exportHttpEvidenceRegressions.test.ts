import { expect, it } from 'vitest';
import { crawlPagesCsv } from '@/services/export';
import { paginationLinks, socialResourceStatus } from '@/services/export/crawlPageEvidence';
import { crawlRun } from './fixtures/export';
import i18n from '@/i18n';
it('does not label a zero-status pagination attempt as an HTTP response', () => {
  const page = { ...crawlRun.result.pages[0], pagination_links: [{ relation: 'next', target_url: 'https://site.test/next', checked_in_run: true, http_status: 0, query_parameter_changes: [] }] } as never;
  expect(paginationLinks(page)).toContain(i18n.t('exportUi.statuses.noResponse'));
  expect(paginationLinks(page)).not.toContain('HTTP 0');
});
it('does not label a zero-status hreflang attempt as an HTTP response in page CSV', () => {
  const run = { ...crawlRun, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0], hreflangs: [{ language: 'pl', target_url: 'https://site.test/pl', target_checked_in_run: true, target_http_status: 0 }] }] } } as never;
  expect(crawlPagesCsv(run)).toContain(i18n.t('exportUi.statuses.noResponse'));
  expect(crawlPagesCsv(run)).not.toContain('HTTP 0');
});
it('does not manufacture an HTTP response from zero-status social resource evidence', () => {
  expect(socialResourceStatus({ url: 'https://site.test/image', checked_in_run: true, http_status: 0 })).toBe(i18n.t('exportUi.statuses.noResponse'));
});
