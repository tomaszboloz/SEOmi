import { describe, expect, it } from 'vitest';
import { crawlCustomSearchCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import { crawlRun } from './fixtures/export';

describe('export contracts: search', () => {
  it('exports custom-search previews with selector metadata and formula-safe values', () => {
      const run = {
        ...crawlRun,
        config: {
          ...crawlRun.config,
          customSearches: [{ id: 'sku', name: 'SKU', selectorType: 'css' as const, query: '[data-sku]', resultType: 'attribute' as const, attribute: 'data-sku' }],
        },
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            custom_search_results: [{ id: 'sku', values: ['=FORMULA', 'SKU-2'], error: null, truncated: false }],
          })),
        },
      } as CrawlRunRecord;
      const output = crawlCustomSearchCsv(run);
      expect(output).toContain('Selector type');
      expect(output).toContain('[data-sku]');
      expect(output).toContain("'=FORMULA");
      expect(output).toContain('SKU-2');
    });
});
