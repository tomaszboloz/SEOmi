import { expect, it } from 'vitest';
import { crawlReportPayload } from '@/services/export';
import { crawlRun } from './fixtures/export';
import type { CrawlReportTemplate } from '@/services/reportTemplates';
it('binds flattened table attribution to its actual source page despite conflicting imported fields', () => {
  const run = JSON.parse(JSON.stringify({ ...crawlRun, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0],
    issues: [{ severity: 'Warning', message: 'Observed', page_url: 'foreign' }],
    links: [{ target_url: '/target', anchor_text: 'Observed', is_internal: true, source_url: 'foreign' }],
    images: [{ src: '/image', lazy_loaded: false, page_url: 'foreign' }],
    frames: [{ src: '/frame', page_url: 'foreign' }],
    custom_search_results: [{ id: 'observed', values: ['Observed'], truncated: false, page_url: 'foreign' }],
  }] } }));
  const template: CrawlReportTemplate = { id: 'observed', name: 'Observed', sections: ['issues', 'links', 'images', 'frames', 'custom-search'], createdAt: '2026-10-01', updatedAt: '2026-10-01' };
  const result = crawlReportPayload(run, template).result as Record<string, Array<Record<string, unknown>>>;
  for (const key of ['issues', 'images', 'frames', 'custom_search']) expect(result[key][0].page_url).toBe('=page');
  expect(result.links[0].source_url).toBe('=page');
  expect(run.result.pages[0].images[0].page_url).toBe('foreign');
});
