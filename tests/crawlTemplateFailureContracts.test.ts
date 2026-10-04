import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCrawlTemplates } from '@/components/Domain/siteAudit/session/useCrawlTemplates';
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE as defaults, loadCrawlReportTemplates,
  loadSelectedCrawlReportTemplateId, saveCrawlReportTemplate,
  saveSelectedCrawlReportTemplateId, deleteCrawlReportTemplate,
} from '@/services/reportTemplates';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('reports failed creation and recovers after writes become available', () => {
  const { result } = renderHook(() => useCrawlTemplates('one'));
  act(() => result.current.setReportTemplateName('QA'));
  const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  act(() => result.current.createReportTemplate());
  expect(result.current.reportTemplateError).toBeTruthy();
  expect(result.current.selectedReportTemplate).toEqual(defaults);
  expect(loadCrawlReportTemplates('one')).toEqual([defaults]);
  writes.mockRestore();
  act(() => result.current.createReportTemplate());
  expect(result.current.reportTemplateError).toBeNull();
  expect(result.current.selectedReportTemplate.name).toBe('QA');
});

it('rejects a draft without sections and retains the editable name', () => {
  const { result } = renderHook(() => useCrawlTemplates('one'));
  act(() => result.current.setReportTemplateName('QA'));
  act(() => defaults.sections.forEach(section => result.current.toggleReportTemplateSection(section)));
  expect(result.current.reportTemplateSections).toEqual([]);
  act(() => result.current.createReportTemplate());
  expect(result.current.reportTemplateError).toBeTruthy();
  expect(result.current.reportTemplateName).toBe('QA');
  expect(loadCrawlReportTemplates('one')).toEqual([defaults]);
});

it('keeps a successfully saved template visible if its selection write fails', () => {
  const { result } = renderHook(() => useCrawlTemplates('one'));
  act(() => result.current.setReportTemplateName('QA'));
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key.includes('report_template_selection')) throw new Error('selection quota');
    original.call(this, key, value);
  });
  act(() => result.current.createReportTemplate());
  expect(result.current.reportTemplateError).toBeTruthy();
  expect(result.current.reportTemplates).toEqual(loadCrawlReportTemplates('one'));
  expect(result.current.reportTemplates.map(template => template.name)).toContain('QA');
  expect(result.current.selectedReportTemplate).toEqual(defaults);
  expect(loadSelectedCrawlReportTemplateId('one')).toBe(defaults.id);
});

it('reports selection cleanup failure after deletion and preserves the actual persisted list', () => {
  const template = saveCrawlReportTemplate('one', { name: 'QA', sections: ['issues'] });
  saveSelectedCrawlReportTemplateId('one', template.id);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('locked'); });
  expect(() => deleteCrawlReportTemplate('one', template.id)).toThrow();
  expect(loadCrawlReportTemplates('one')).toEqual([defaults]);
  expect(loadSelectedCrawlReportTemplateId('one')).toBe(defaults.id);
});

it('ignores invalid service selections and empty deletion IDs without writes', () => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  const removes = vi.spyOn(Storage.prototype, 'removeItem');
  saveSelectedCrawlReportTemplateId('one', 'missing');
  deleteCrawlReportTemplate('one', '');
  deleteCrawlReportTemplate('one', defaults.id);
  expect(writes).not.toHaveBeenCalled();
  expect(removes).not.toHaveBeenCalled();
});

it('refreshes the form after deletion succeeds but selection cleanup fails', () => {
  const template = saveCrawlReportTemplate('one', { name: 'QA', sections: ['issues'] });
  saveSelectedCrawlReportTemplateId('one', template.id);
  const { result } = renderHook(() => useCrawlTemplates('one'));
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('locked'); });
  act(() => result.current.removeReportTemplate());
  expect(result.current.reportTemplateError).toBeTruthy();
  expect(result.current.reportTemplates).toEqual([defaults]);
  expect(result.current.selectedReportTemplate).toEqual(defaults);
  expect(result.current.reportTemplateSections).toEqual(defaults.sections);
  expect(result.current.reportTemplateName).toBe('');
});
