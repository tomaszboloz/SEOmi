import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrawlTemplates } from '../src/components/Domain/siteAudit/session/useCrawlTemplates';
import { useCrawlErrorFilters } from '../src/components/Domain/siteAudit/session/useCrawlErrorFilters';
import { useCrawlFormState } from '../src/components/Domain/siteAudit/session/useCrawlFormState';
import { useCrawlExecution } from '../src/components/Domain/siteAudit/session/useCrawlExecution';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/stores/toolsStore', () => ({
  useToolsStore: vi.fn((selector) => {
    const state = {
      crawlUrl: '',
      crawlLimit: 100,
      crawlConfig: { seedUrls: [] },
      setCrawlConfig: vi.fn(),
      saveCrawlRequestProfile: vi.fn(),
      deleteCrawlRequestProfile: vi.fn(),
      crawlRequestProfiles: [],
      crawlResult: null,
      isCrawling: false,
      selectedCrawlRunId: null,
      crawlRuns: [],
      setCrawlUrl: vi.fn(),
      setCrawlLimit: vi.fn(),
      startSiteCrawl: vi.fn(),
    };
    return selector(state);
  })
}));

vi.mock('@/services/storage', () => ({
  readEphemeralStorage: vi.fn(),
  removeEphemeralStorage: vi.fn(),
  readStorage: vi.fn(),
  writeStorage: vi.fn(),
  readJsonStorage: vi.fn(),
  writeJsonStorage: vi.fn(),
}));

vi.mock('@/services/reportTemplates', () => ({
  DEFAULT_CRAWL_REPORT_TEMPLATE: { id: 'default', sections: [] },
  REPORT_TEMPLATE_SECTIONS: [],
  deleteCrawlReportTemplate: vi.fn(),
  loadCrawlReportTemplates: vi.fn(() => []),
  loadSelectedCrawlReportTemplateId: vi.fn(() => 'default'),
  saveCrawlReportTemplate: vi.fn(),
  saveSelectedCrawlReportTemplateId: vi.fn(),
}));

describe('siteAuditSessionModules', () => {
  const mockServices = { invoke: vi.fn(), importUrls: vi.fn(), compare: vi.fn(), downloadPdf: vi.fn() };

  it('renders useCrawlTemplates', () => {
    const { result } = renderHook(() => useCrawlTemplates('proj-1'));
    expect(result.current.selectedReportTemplate?.id).toBe('default');
  });

  it('renders useCrawlErrorFilters', () => {
    const { result } = renderHook(() => useCrawlErrorFilters('https://example.com', 'proj-1', mockServices));
    expect(result.current.severityFilter).toBe('all');
  });

  it('renders useCrawlFormState', () => {
    const { result } = renderHook(() => useCrawlFormState('proj-1', mockServices));
    expect(result.current.inputUrl).toBe('');
  });

  it('renders useCrawlExecution', () => {
    const validate = vi.fn().mockResolvedValue({ valid: true });
    const { result } = renderHook(() => useCrawlExecution('proj-1', mockServices, 'https://example.com', 100, validate, { id: 'default', sections: [], builtIn: true, name: 'Default', createdAt: '', updatedAt: '' }));
    expect(result.current.comparisonRunId).toBe('');
  });
});
