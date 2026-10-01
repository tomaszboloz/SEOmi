import { describe, expect, it } from 'vitest';
import { crawlPagesCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import i18n from '@/i18n';
import { crawlRun } from './fixtures/export';

describe('export contracts: redirects', () => {
  it('exports per-hop redirect timing when it is present', () => {
      const run = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            redirect_chain: [{
              from_url: 'https://example.com/old',
              http_status: 301,
              to_url: 'https://example.com/',
              response_time_ms: 42,
            }],
            redirect_stop_reason: 'Redirect limit of 10 exceeded',
          })),
        },
      } as CrawlRunRecord;
  
      expect(crawlPagesCsv(run)).toContain('301: https://example.com/old -> https://example.com/ (42 ms)');
      expect(crawlPagesCsv(run)).toContain('Redirect stop reason');
      expect(crawlPagesCsv(run)).toContain('Redirect limit of 10 exceeded');
    });

  it('exports client-side redirect source, delay, raw declaration and resolved target', () => {
      const redirectRun = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            client_redirects: [
              { source: 'meta-refresh', declaration: "0; URL='/next'", delay_seconds: 0, target_url: 'https://example.com/next' },
              { source: 'http-refresh', declaration: '5; url="/later"', delay_seconds: 5, target_url: 'https://example.com/later' },
            ],
          })),
        },
      } as CrawlRunRecord;
      const output = crawlPagesCsv(redirectRun);
  
      expect(output).toContain('Client-side redirects');
      expect(output).toContain(`${i18n.t('crawlDeepUi.mechanismMetaRefresh')}; delay=0s; target=https://example.com/next`);
      expect(output).toContain(`${i18n.t('crawlDeepUi.mechanismHttpRefresh')}; delay=5s; target=https://example.com/later`);
    });
});
