import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCrawlTemplates } from '@/components/Domain/siteAudit/session/useCrawlTemplates';
import * as reportTemplates from '@/services/reportTemplates';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('crawl template hook error and fallback contracts', () => {
  it('uses the translated fallback for non-Error selection failures', () => {
    const template = reportTemplates.saveCrawlReportTemplate('project', {
      name: 'Custom', sections: ['issues'],
    });
    const { result } = renderHook(() => useCrawlTemplates('project'));
    vi.spyOn(reportTemplates, 'saveSelectedCrawlReportTemplateId').mockImplementation(() => {
      throw 'selection failed';
    });

    act(() => result.current.selectReportTemplate(template.id));

    expect(result.current.reportTemplateError).toBe('siteAudit.templateSaveError');
    expect(result.current.selectedReportTemplate.id).toBe(reportTemplates.DEFAULT_CRAWL_REPORT_TEMPLATE.id);
  });

  it('uses the translated fallback for non-Error creation failures', () => {
    const { result } = renderHook(() => useCrawlTemplates('project'));
    act(() => result.current.setReportTemplateName('Custom'));
    vi.spyOn(reportTemplates, 'saveCrawlReportTemplate').mockImplementation(() => {
      throw 'creation failed';
    });

    act(() => result.current.createReportTemplate());

    expect(result.current.reportTemplateError).toBe('siteAudit.templateSaveError');
    expect(result.current.selectedReportTemplate).toEqual(reportTemplates.DEFAULT_CRAWL_REPORT_TEMPLATE);
  });

  it('falls back to the built-in template when a successful delete reloads no templates', () => {
    const template = reportTemplates.saveCrawlReportTemplate('project', {
      name: 'Custom', sections: ['issues'],
    });
    const { result } = renderHook(() => useCrawlTemplates('project'));
    act(() => result.current.selectReportTemplate(template.id));
    vi.spyOn(reportTemplates, 'deleteCrawlReportTemplate').mockImplementation(() => undefined);
    vi.spyOn(reportTemplates, 'loadCrawlReportTemplates').mockReturnValue([]);

    act(() => result.current.removeReportTemplate());

    expect(result.current.selectedReportTemplate).toEqual(reportTemplates.DEFAULT_CRAWL_REPORT_TEMPLATE);
    expect(result.current.reportTemplates).toEqual([]);
  });

  it('keeps the selected template when a failed delete still finds it', () => {
    const template = reportTemplates.saveCrawlReportTemplate('project', {
      name: 'Custom', sections: ['issues'],
    });
    const { result } = renderHook(() => useCrawlTemplates('project'));
    act(() => result.current.selectReportTemplate(template.id));
    vi.spyOn(reportTemplates, 'deleteCrawlReportTemplate').mockImplementation(() => {
      throw 'delete failed';
    });
    vi.spyOn(reportTemplates, 'loadCrawlReportTemplates').mockReturnValue([
      reportTemplates.DEFAULT_CRAWL_REPORT_TEMPLATE, template,
    ]);

    act(() => result.current.removeReportTemplate());

    expect(result.current.reportTemplateError).toBe('siteAudit.templateSaveError');
    expect(result.current.selectedReportTemplate).toEqual(template);
  });

  it('uses the built-in state when a failed delete reloads an empty list', () => {
    const template = reportTemplates.saveCrawlReportTemplate('project', {
      name: 'Custom', sections: ['issues'],
    });
    const { result } = renderHook(() => useCrawlTemplates('project'));
    act(() => result.current.selectReportTemplate(template.id));
    vi.spyOn(reportTemplates, 'deleteCrawlReportTemplate').mockImplementation(() => {
      throw 'delete failed';
    });
    vi.spyOn(reportTemplates, 'loadCrawlReportTemplates').mockReturnValue([]);

    act(() => result.current.removeReportTemplate());

    expect(result.current.reportTemplateError).toBe('siteAudit.templateSaveError');
    expect(result.current.selectedReportTemplate).toEqual(reportTemplates.DEFAULT_CRAWL_REPORT_TEMPLATE);
  });
});
