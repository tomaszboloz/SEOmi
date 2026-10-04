import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCrawlTemplates } from '@/components/Domain/siteAudit/session/useCrawlTemplates';
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE as defaults, REPORT_TEMPLATE_SECTIONS,
  loadCrawlReportTemplates, loadSelectedCrawlReportTemplateId,
  saveCrawlReportTemplate, saveSelectedCrawlReportTemplateId, deleteCrawlReportTemplate,
} from '@/services/reportTemplates';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
const custom = () => saveCrawlReportTemplate('one', { name: 'Custom', sections: ['issues'] });
const rejectWrites = () => vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
  throw new Error('storage full');
});

it('loads project selection and resets drafts and errors on project transitions', () => {
  const template = custom();
  saveSelectedCrawlReportTemplateId('one', template.id);
  const { result, rerender } = renderHook(({ id }) => useCrawlTemplates(id), { initialProps: { id: 'one' } });
  expect(result.current.selectedReportTemplate).toEqual(template);
  expect(result.current.reportTemplateName).toBe('Custom');
  expect(result.current.reportTemplateSections).toEqual(['issues']);
  act(() => result.current.setReportTemplateName(''));
  act(() => result.current.createReportTemplate());
  expect(result.current.reportTemplateError).toBeTruthy();
  rerender({ id: 'two' });
  expect(result.current.selectedReportTemplate).toEqual(defaults);
  expect(result.current.reportTemplateName).toBe('');
  expect(result.current.reportTemplateSections).toEqual(defaults.sections);
  expect(result.current.reportTemplateError).toBeNull();
  expect(loadSelectedCrawlReportTemplateId('one')).toBe(template.id);
});

it('toggles sections, creates a normalized template and persists project ownership', () => {
  const { result } = renderHook(() => useCrawlTemplates('one'));
  act(() => result.current.toggleReportTemplateSection('summary'));
  expect(result.current.reportTemplateSections).toEqual(defaults.sections.filter(s => s !== 'summary'));
  act(() => result.current.toggleReportTemplateSection('summary'));
  expect(result.current.reportTemplateSections).toEqual([...defaults.sections.filter(s => s !== 'summary'), 'summary']);
  act(() => result.current.setReportTemplateName('  QA  '));
  act(() => result.current.createReportTemplate());
  expect(result.current.selectedReportTemplate.name).toBe('QA');
  expect(result.current.reportTemplateName).toBe('QA');
  expect(loadSelectedCrawlReportTemplateId('one')).toBe(result.current.selectedReportTemplate.id);
  expect(loadCrawlReportTemplates('two')).toEqual([defaults]);
  expect(result.current.reportTemplateSectionLabels).toEqual(Object.fromEntries(
    REPORT_TEMPLATE_SECTIONS.map(s => [s, `siteAudit.reportSections.${s}`]),
  ));
});

it('selects and removes custom templates, falling back to the full built-in report', () => {
  const template = custom();
  const { result } = renderHook(() => useCrawlTemplates('one'));
  act(() => result.current.selectReportTemplate(template.id));
  expect(result.current.selectedReportTemplate).toEqual(template);
  act(() => result.current.removeReportTemplate());
  expect(loadCrawlReportTemplates('one')).toEqual([defaults]);
  expect(result.current.selectedReportTemplate).toEqual(defaults);
  expect(result.current.reportTemplateName).toBe('');
  expect(result.current.reportTemplateSections).toEqual(defaults.sections);
  act(() => result.current.selectReportTemplate('missing'));
  expect(loadSelectedCrawlReportTemplateId('one')).toBe(defaults.id);
  act(() => result.current.removeReportTemplate());
  expect(loadCrawlReportTemplates('one')).toEqual([defaults]);
});

it('requires a project for creation and leaves storage untouched for projectless actions', () => {
  const { result } = renderHook(() => useCrawlTemplates(null));
  act(() => result.current.createReportTemplate());
  expect(result.current.reportTemplateError).toBe('siteAudit.templateProjectRequired');
  act(() => result.current.removeReportTemplate());
  act(() => result.current.selectReportTemplate(defaults.id));
  expect(result.current.reportTemplateError).toBeNull();
  expect(localStorage.length).toBe(0);
});

it('retains the selected custom template and reports a failed deletion', () => {
  const template = custom();
  saveSelectedCrawlReportTemplateId('one', template.id);
  const { result } = renderHook(() => useCrawlTemplates('one'));
  rejectWrites();
  act(() => result.current.removeReportTemplate());
  expect(result.current.reportTemplateError).toBeTruthy();
  expect(result.current.selectedReportTemplate).toEqual(template);
  expect(loadSelectedCrawlReportTemplateId('one')).toBe(template.id);
  expect(loadCrawlReportTemplates('one')).toContainEqual(template);
});

it('does not announce a successful selection when persistence fails', () => {
  const template = custom();
  const { result } = renderHook(() => useCrawlTemplates('one'));
  rejectWrites();
  act(() => result.current.selectReportTemplate(template.id));
  expect(result.current.reportTemplateError).toBeTruthy();
  expect(result.current.selectedReportTemplate).toEqual(defaults);
  expect(loadSelectedCrawlReportTemplateId('one')).toBe(defaults.id);
});

it('throws on a failed service deletion without clearing the persisted selection', () => {
  const template = custom();
  saveSelectedCrawlReportTemplateId('one', template.id);
  rejectWrites();
  expect(() => deleteCrawlReportTemplate('one', template.id)).toThrow();
  expect(loadSelectedCrawlReportTemplateId('one')).toBe(template.id);
});
