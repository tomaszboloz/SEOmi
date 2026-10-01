import { describe, expect, it } from 'vitest';
import { crawlPagesCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import i18n from '@/i18n';
import { crawlRun } from './fixtures/export';

describe('export contracts: pagination', () => {
  it('exports pagination declarations, query changes, canonical alignment and in-run HTTP status', () => {
      const paginationRun = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            pagination_declaration_count: 1,
            pagination_invalid_declaration_count: 0,
            pagination_canonical_alignment: 'self-canonical',
            pagination_links: [{
              relation: 'next', target_url: 'https://example.com/articles?page=2',
              query_parameter_changes: ['page: 1 → 2'], http_status: 200, checked_in_run: true,
            }],
          })),
        },
      } as CrawlRunRecord;
      const output = crawlPagesCsv(paginationRun);

      expect(output).toContain('Pagination declarations');
      expect(output).toContain('Pagination/canonical alignment');
      expect(output).toContain('self-canonical');
      expect(output).toContain('next: https://example.com/articles?page=2 (HTTP 200; page: 1 → 2)');
    });

  it('exports hreflang target verification evidence without inventing out-of-run status', () => {
      const internationalRun = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            hreflangs: [
              { language: 'en', target_url: 'https://example.com/en/', target_http_status: 200, target_checked_in_run: true, reciprocal_in_run: true, target_canonical_alignment: 'self-canonical' },
              { language: 'de', target_url: 'https://example.com/de/', target_http_status: null, target_checked_in_run: false, reciprocal_in_run: null, target_canonical_alignment: null },
            ],
          })),
        },
      } as CrawlRunRecord;
      const output = crawlPagesCsv(internationalRun);

      const crawlHeaders = i18n.t('exportUi.headers.crawlPages', { returnObjects: true }) as string[];
      expect(output).toContain(crawlHeaders.find((header) => header.includes('Hreflang'))!);
      expect(output).toContain(`en: https://example.com/en/ (${i18n.t('exportUi.statuses.http', { status: 200 })}; ${i18n.t('exportUi.statuses.reciprocalYes')}; self-canonical)`);
      expect(output).toContain(`de: https://example.com/de/ (${i18n.t('exportUi.statuses.notChecked')}; ${i18n.t('exportUi.statuses.reciprocityUnverified')}; ${i18n.t('exportUi.statuses.canonicalUnverified')})`);
    });
});
