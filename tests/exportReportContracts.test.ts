import { expect, it } from 'vitest';
import { crawlReportPayload } from '@/services/export/crawlReport';
import type { CrawlReportTemplate, ReportTemplateSection } from '@/services/reportTemplates';
import { crawlRun, crawlRunWithResources } from './fixtures/export';
const template = (sections: ReportTemplateSection[]): CrawlReportTemplate => ({ id: 'observed', name: 'Observed selection', sections, createdAt: '2026-10-01', updatedAt: '2026-10-01' });
it('retains the source snapshot without filtering when no template is selected', () => {
  const payload = crawlReportPayload(crawlRun);
  expect(payload.result).toBe(crawlRun.result); expect(payload.report_template).toBeUndefined();
  expect(payload.run).toMatchObject({ id: crawlRun.id, configuration: crawlRun.config });
});
it('includes exactly the selected tables from the saved source snapshot', () => {
  const run = { ...crawlRunWithResources, result: { ...crawlRunWithResources.result, limit_reasons: ['page-limit'], pages: [{ ...crawlRun.result.pages[0],
    frames: [{ src: '/frame', resolved_url: 'https://site.test/frame' }], custom_search_results: [{ id: 'search', values: ['Observed'], truncated: false }],
    semantic_terms: ['coffee'], semantic_links: [], semantic_excerpts: ['Observed'],
  }] } } as never;
  const sections: ReportTemplateSection[] = ['configuration', 'pages', 'issues', 'links', 'images', 'resources', 'frames', 'custom-search', 'semantic'];
  const payload = crawlReportPayload(run, template(sections)); const result = payload.result as Record<string, unknown>;
  expect(result.configuration).toBe(crawlRun.config); expect(result.pages).toHaveLength(1);
  expect(result.links).toEqual([expect.objectContaining({ source_url: '=page', target_url: '-link' })]);
  expect(result.images).toEqual([expect.objectContaining({ page_url: '=page', src: '@image' })]);
  expect(result.frames).toEqual([expect.objectContaining({ page_url: '=page', src: '/frame' })]);
  expect(result.custom_search).toEqual([expect.objectContaining({ page_url: '=page', id: 'search', values: ['Observed'] })]);
  expect(result.semantic).toEqual([expect.objectContaining({ semantic_terms: ['coffee'], semantic_excerpts: ['Observed'], semantic_links: [] })]);
  expect(result.resources).toBe(crawlRunWithResources.result.resources); expect(result.limit_reasons).toEqual(['page-limit']);
});
it('keeps absent optional table evidence empty rather than manufacturing entries', () => {
  const payload = crawlReportPayload(crawlRun, template(['resources', 'frames', 'custom-search', 'semantic']));
  const result = payload.result as Record<string, unknown>;
  expect(result.resources).toEqual([]); expect(result.frames).toEqual([]); expect(result.custom_search).toEqual([]);
  expect(result.semantic).toEqual([expect.objectContaining({ semantic_terms: [], semantic_excerpts: [], semantic_links: [] })]);
});
it('keeps a missing legacy pages array empty and carries only recorded crawl-level evidence', () => {
  const payload = crawlReportPayload({ ...crawlRun, result: {} } as never, template(['pages', 'frames', 'custom-search']));
  const result = payload.result as Record<string, unknown>;
  expect(result.pages).toEqual([]); expect(result.frames).toEqual([]); expect(result.custom_search).toEqual([]);
  expect(result).not.toHaveProperty('robots_txt_status');
});
