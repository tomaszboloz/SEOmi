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

  it('exports link placement evidence from #70 and leaves it empty for older runs', () => {
    const link = {
      target_url: 'https://site.example/b', anchor_text: 'b', is_internal: true, zone: 'main', zone_method: 'dom-ancestry',
      context_before: 'read the', context_after: 'guide first', context_truncated: true, context_anchor_offset: 2, section_heading: 'Pricing plans',
    };
    const placed = { ...crawlRun, result: { ...crawlRun.result, pages: crawlRun.result.pages.map((page) => ({ ...page, links: [link] })) } } as CrawlRunRecord;
    const [header, row] = crawlLinksCsv(placed).split(/\r?\n/u).filter((line) => line.includes('Section heading') || line.includes('Pricing plans'));
    expect(header).toContain('"DOM zone","Zone method","Context before","Context after","Context truncated","Anchor word offset","Section heading"');
    expect(row).toContain('"main","dom-ancestry","read the","guide first","true","2","Pricing plans"');
    const legacy = { ...placed, result: { ...placed.result, pages: placed.result.pages.map((page) => ({ ...page, links: [{ target_url: 'https://site.example/c', anchor_text: 'c', is_internal: true }] })) } } as CrawlRunRecord;
    expect(crawlLinksCsv(legacy)).toMatch(/https:\/\/site\.example\/c.*,"","","","","","",""\s*$/mu);
  });
});
