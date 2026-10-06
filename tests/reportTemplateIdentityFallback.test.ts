import { afterEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE, loadCrawlReportTemplates, loadSelectedCrawlReportTemplateId,
  saveCrawlReportTemplate, saveSelectedCrawlReportTemplateId,
} from '@/services/reportTemplates';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

it('refreshes the built-in report name after a language change while preserving custom names', async () => {
  const originalLanguage = i18n.language;
  const custom = saveCrawlReportTemplate('locale-owner', {
    id: 'report-custom', name: 'Client report', sections: ['issues'],
  });
  try {
    await i18n.changeLanguage('pl');
    expect(loadCrawlReportTemplates('locale-owner')).toEqual([
      { ...DEFAULT_CRAWL_REPORT_TEMPLATE, name: 'Site health · pełny raport' }, custom,
    ]);
    await i18n.changeLanguage('en');
    expect(loadCrawlReportTemplates('locale-owner')).toEqual([
      { ...DEFAULT_CRAWL_REPORT_TEMPLATE, name: 'Site health · full report' }, custom,
    ]);
  } finally {
    await i18n.changeLanguage(originalLanguage);
  }
});

it.each([undefined, {}])('persists and selects a project template when crypto UUID support is %j', crypto => {
  vi.stubGlobal('crypto', crypto);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));

  const template = saveCrawlReportTemplate('fallback-owner', {
    name: ' Fallback report ', sections: ['summary', 'issues', 'summary'],
  });
  expect(template.id).toMatch(/^report-[a-z0-9]+$/);
  expect(template.name).toBe('Fallback report');
  expect(template.sections).toEqual(['summary', 'issues']);
  expect(template.createdAt).toBe('2026-10-06T12:00:00.000Z');
  expect(template.updatedAt).toBe(template.createdAt);
  expect(loadCrawlReportTemplates('fallback-owner')).toEqual([DEFAULT_CRAWL_REPORT_TEMPLATE, template]);

  saveSelectedCrawlReportTemplateId('fallback-owner', template.id);
  expect(loadSelectedCrawlReportTemplateId('fallback-owner')).toBe(template.id);
  expect(loadCrawlReportTemplates('other-project')).toEqual([DEFAULT_CRAWL_REPORT_TEMPLATE]);
  expect(loadSelectedCrawlReportTemplateId('other-project')).toBe(DEFAULT_CRAWL_REPORT_TEMPLATE.id);
});
