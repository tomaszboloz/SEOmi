import { describe, expect, it } from 'vitest';
import { crawlLinksCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import { crawlRun } from './fixtures/export';

describe('export contracts: links', () => {
  it('exports external link check status, redirects, errors and timestamps', () => {
      const checkedRun = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({ ...page, links: [{
            target_url: 'https://outside.example/', anchor_text: 'outside', rel: 'nofollow', is_internal: false,
            target_http_status: 302, target_response_time_ms: 48, target_redirect_url: 'https://new.example/',
            target_request_error_kind: undefined, target_checked_at: '2026-09-22T12:00:00.000Z',
          }] })),
        },
      } as CrawlRunRecord;
      const output = crawlLinksCsv(checkedRun);
      expect(output).toContain('Target response time ms');
      expect(output).toContain('https://new.example/');
      expect(output).toContain('302');
      expect(output).toContain('2026-09-22T12:00:00.000Z');
    });
});
