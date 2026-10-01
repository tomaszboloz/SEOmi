import { describe, expect, it } from 'vitest';
import { crawlReportPayload } from '@/services/export';
import type { CrawlReportTemplate } from '@/services/reportTemplates';
import { crawlRun } from './fixtures/export';

describe('export contracts: templates', () => {
  it('exports only the selected JSON sections while keeping the run envelope', () => {
      const template: CrawlReportTemplate = {
        id: 'technical-qa', name: 'Technical QA', sections: ['summary', 'issues', 'semantic'],
        createdAt: '2026-09-21T09:00:00.000Z', updatedAt: '2026-09-21T09:00:00.000Z',
      };
      const payload = crawlReportPayload(crawlRun, template);
      const result = payload.result as Record<string, unknown>;
      expect(payload.report_template).toMatchObject({ id: 'technical-qa', sections: ['summary', 'issues', 'semantic'] });
      expect(result.pages).toBeUndefined();
      expect(result.limit_reasons).toEqual([]);
      expect(result.links).toBeUndefined();
      expect(result.issues).toEqual([{ page_url: '=page', severity: 'Warning', message: '=issue' }]);
      expect(result.semantic).toEqual([{ url: '=page', final_url: '+final', title: '@title', semantic_terms: [], semantic_excerpts: [], semantic_links: [], content_hash: undefined, content_simhash: undefined }]);
    });
});
