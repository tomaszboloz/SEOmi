import { afterEach, expect, it, vi } from 'vitest';
import i18n, { languageReady } from '@/i18n';
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE as builtIn, loadCrawlReportTemplates,
  loadSelectedCrawlReportTemplateId, saveCrawlReportTemplate, saveSelectedCrawlReportTemplateId,
} from '@/services/reportTemplates';

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

it('updates the built-in report label after a language change without renaming a saved custom report', async () => {
  await languageReady;
  await i18n.changeLanguage('en');
  const template = saveCrawlReportTemplate('reports', { name: 'My QA report', sections: ['issues'] });
  saveSelectedCrawlReportTemplateId('reports', template.id);
  const english = builtIn.name;
  await i18n.changeLanguage('pl');
  expect(builtIn.name).toBe('Site health · pełny raport');
  expect(builtIn.name).not.toBe(english);
  expect(loadCrawlReportTemplates('reports')).toEqual([builtIn, template]);
  expect(loadSelectedCrawlReportTemplateId('reports')).toBe(template.id);
  expect(loadCrawlReportTemplates('another')).toEqual([builtIn]);
});

it.each([undefined, {}])('saves and selects a report when the WebView crypto API is unavailable: %j', crypto => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T08:00:00.000Z'));
  vi.stubGlobal('crypto', crypto);
  const template = saveCrawlReportTemplate('legacy-webview', { name: 'Technical report', sections: ['summary', 'issues'] });
  expect(template.id).toMatch(/^report-[a-z0-9]+$/);
  expect(template.createdAt).toBe('2026-10-06T08:00:00.000Z');
  saveSelectedCrawlReportTemplateId('legacy-webview', template.id);
  expect(loadSelectedCrawlReportTemplateId('legacy-webview')).toBe(template.id);
  expect(loadCrawlReportTemplates('legacy-webview')).toEqual([builtIn, template]);
  expect(loadCrawlReportTemplates('other')).toEqual([builtIn]);
});

it('keeps a saved custom report selected when its display name changes', () => {
  const initial = saveCrawlReportTemplate('reports', { id: 'report-custom', name: 'Before', sections: ['issues'] });
  saveSelectedCrawlReportTemplateId('reports', initial.id);
  const updated = saveCrawlReportTemplate('reports', { id: initial.id, name: 'After', sections: ['links'] });
  expect(loadSelectedCrawlReportTemplateId('reports')).toBe(initial.id);
  expect(loadCrawlReportTemplates('reports')).toEqual([builtIn, updated]);
  expect(updated.createdAt).toBe(initial.createdAt);
  expect(updated.name).toBe('After');
  expect(updated.sections).toEqual(['links']);
});
