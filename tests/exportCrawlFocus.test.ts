import { afterEach, expect, it, vi } from 'vitest';
import { downloadCrawlPdf } from '@/services/export';
import { crawlFocusSummary, FOCUS_PDF_PAGES, summarizeSiteFocus } from '@/services/export/focusSummary';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { REPORT_TEMPLATE_SECTIONS } from '@/services/reportTemplates';
import { invokeTauriCommand } from '@/services/tauri';
import type { CrawlRunRecord } from '@/types';
import { diabetesSite, topicArticles, DIABETES_TERMS } from './siteFocusFixtures';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
vi.mock('@/services/download', () => ({ downloadBlob: vi.fn() }));
afterEach(() => vi.mocked(invokeTauriCommand).mockReset());

const START = 'https://diabetes.test/';
const runOf = (pages = diabetesSite(), patch: Record<string, unknown> = {}) => ({
  id: 'run-focus', completedAt: '2026-10-15T10:00:00Z', startUrl: START, config: {},
  result: { start_url: START, pages, resources: [], ...patch },
}) as unknown as CrawlRunRecord;

it('summarises the report without the heavy model and keeps only the worst pages', () => {
  const report = buildSiteFocusReport(diabetesSite(), START, { now: '2026-10-15T00:00:00Z' });
  const summary = summarizeSiteFocus(report);
  expect(JSON.stringify(summary)).not.toContain('documentFrequency');
  expect(summary.score).toBe(report.score);
  expect(summary.band).toBe(report.band);
  expect(summary.core_topic.terms.length).toBeLessThanOrEqual(8);
  expect(summary.pages.length).toBeLessThanOrEqual(FOCUS_PDF_PAGES);
  expect(summary.pages.map((page) => page.trs)).toEqual([...summary.pages.map((page) => page.trs)].sort((a, b) => a - b));
  expect(summary.pages.every((page) => page.type !== 'technical')).toBe(true);
  expect(summary.pages[0].url).toContain('/phones/');
  expect(summary.pages[0].playbook.type).toBe('A');
  expect(summary.pages[0].playbook.options.map((option) => option.code)).toContain('remove-redirect');
  expect(summary.recommendations[0]).toMatchObject({ code: 'remove-offtopic', gain: expect.any(Number) });
  expect(summary.counts.off_topic).toBe(3);
  expect(summary.sub_sites).toEqual([]);
  expect(summary.core_topic).not.toHaveProperty('manual_input');
});

it('caps the page list and reports manual topics, skipped pages and sub-sites', () => {
  const many = topicArticles('diabetes.test', '/articles', DIABETES_TERMS, 60);
  const skipped = { ...many[0], url: 'https://diabetes.test/gone', final_url: 'https://diabetes.test/gone', http_status: 404 };
  const report = buildSiteFocusReport([...many, skipped], START, { manualTopic: 'diabetes insulin' });
  const summary = summarizeSiteFocus(report);
  expect(summary.pages).toHaveLength(FOCUS_PDF_PAGES);
  expect(summary.counts.skipped).toBe(1);
  expect(summary.core_topic.manual_input).toBe('diabetes insulin');
  expect(typeof summary.core_topic.manual_matched).toBe('boolean');
});

it('builds a summary only for completed runs', () => {
  expect(crawlFocusSummary(runOf())?.page_count).toBe(diabetesSite().length);
  expect(crawlFocusSummary(runOf([]))).toBeUndefined();
  expect(crawlFocusSummary(runOf(diabetesSite(), { cancelled: true }))).toBeUndefined();
});

it('sends the focus summary with the PDF run payload when the template allows it', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(btoa('%PDF-1.7'));
  const run = runOf();
  await downloadCrawlPdf(run);
  const sent = vi.mocked(invokeTauriCommand).mock.calls[0][1] as { run: Record<string, unknown> };
  expect(sent.run.focus).toMatchObject({ band: expect.any(String), pages: expect.any(Array), recommendations: expect.any(Array) });

  const template = { id: 't', name: 'T', createdAt: '', updatedAt: '' };
  await downloadCrawlPdf(run, { ...template, sections: ['summary', 'focus'] });
  expect((vi.mocked(invokeTauriCommand).mock.calls[1][1] as { run: Record<string, unknown> }).run.focus).toBeDefined();
  await downloadCrawlPdf(run, { ...template, sections: ['summary'] });
  expect((vi.mocked(invokeTauriCommand).mock.calls[2][1] as { run: Record<string, unknown> }).run).not.toHaveProperty('focus');
  await downloadCrawlPdf(runOf([]));
  expect((vi.mocked(invokeTauriCommand).mock.calls[3][1] as { run: Record<string, unknown> }).run).not.toHaveProperty('focus');
});

it('lists focus as a report template section with an English label', async () => {
  expect(REPORT_TEMPLATE_SECTIONS).toContain('focus');
  const en = (await import('@/i18n/locales/en.json')).default as { siteAudit: { reportSections: Record<string, string> } };
  expect(en.siteAudit.reportSections.focus).toBeTruthy();
});
