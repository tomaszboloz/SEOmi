import { describe, expect, it } from 'vitest';
import { crawlPagesCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import { crawlRun } from './fixtures/export';

describe('export contracts: markup', () => {
  it('exports HTML validation findings with source positions and escaped source excerpts', () => {
      const run = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            charset: 'windows-1252',
            detected_charset: 'UTF-8',
            html_validation_findings: [{
              code: 'html-uri-invalid',
              severity: 'Warning',
              message: 'Invalid URI',
              element: 'a',
              attribute: 'href',
              value: '=unsafe%ZZ',
              line: 7,
              column: 12,
              source_excerpt: '<a href="=unsafe%ZZ">',
            }],
            html_validation_truncated: false,
          })),
        },
      } as CrawlRunRecord;

      const output = crawlPagesCsv(run);
      expect(output).toContain('Detected charset');
      expect(output).toContain('HTML validation findings');
      expect(output).toContain('at 7:12');
      expect(output).toContain('=unsafe%ZZ');
      expect(output).toContain('source: <a href=""=unsafe%ZZ"">');
    });
});
