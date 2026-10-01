import { describe, expect, it } from 'vitest';
import { crawlPagesCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import { crawlRun } from './fixtures/export';

describe('export contracts: amp', () => {
  it('exports the declared AMP URL and whether its HTTP response was checked in-run', () => {
      const ampRun = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            amp_url: 'https://example.com/amp/',
            amp_target_http_status: 404,
            amp_target_checked_in_run: true,
            amp_target_canonical_alignment: 'canonical-points-elsewhere',
          })),
        },
      } as CrawlRunRecord;
      const output = crawlPagesCsv(ampRun);
  
      expect(output).toContain('AMP target status');
      expect(output).toContain('AMP target checked in run');
      expect(output).toContain('AMP target canonical alignment');
      expect(output).toContain('https://example.com/amp/');
      expect(output).toContain('"404"');
      expect(output).toContain('"yes"');
      expect(output).toContain('"no"');
    });
});
