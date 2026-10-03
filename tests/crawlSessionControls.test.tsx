import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlWorkspaceNavigation } from '@/components/Domain/siteAudit/CrawlWorkspaceNavigation';
import { CrawlResumePanel } from '@/components/Domain/siteAudit/CrawlResumePanel';
import { CrawlComparisonSelector } from '@/components/Domain/siteAudit/CrawlComparisonSelector';
import { CrawlReportTemplateSelector } from '@/components/Domain/siteAudit/CrawlReportTemplateSelector';
import { CrawlRenderOptions } from '@/components/Domain/siteAudit/CrawlRenderOptions';
import { CrawlExportActions } from '@/components/Domain/siteAudit/CrawlExportActions';

import { DEFAULT_CRAWL_REPORT_TEMPLATE } from '@/services/reportTemplates';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { session } from "./fixtures/crawlSessionControlsContracts";
const exports = vi.hoisted(() => ({
  downloadCrawlJson: vi.fn(), downloadCrawlPagesCsv: vi.fn(), downloadCrawlLinksCsv: vi.fn(),
  downloadCrawlImagesCsv: vi.fn(), downloadCrawlResourcesCsv: vi.fn(), downloadCrawlIssuesCsv: vi.fn(),
}));

vi.mock('@/services/export', () => exports);

describe('crawl session public controls', () => {
beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
  });

it('hides navigation until results exist, then requests the results and next map navigation', () => {
    const scrollToResults = vi.fn();
    const setMapNavigationRequest = vi.fn();
    const view = render(<CrawlWorkspaceNavigation session={session({ crawlResult: null, scrollToResults, setMapNavigationRequest })} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    view.rerender(<CrawlWorkspaceNavigation session={session({ crawlResult: createCrawlResultFixture({ pages_crawled: 7 }), scrollToResults, setMapNavigationRequest })} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('siteAudit.backToResults') }));
    expect(scrollToResults).toHaveBeenCalledExactlyOnceWith();
    fireEvent.click(screen.getByRole('button', { name: `${i18n.t('siteAudit.mapDirect')}, 7` }));
    const update = setMapNavigationRequest.mock.calls[0][0] as (previous: number) => number;
    expect(update(12)).toBe(13);
  });

it('offers recovery only for an interrupted crawl and keeps resume separate from discard', () => {
    const resumeInterruptedCrawl = vi.fn().mockResolvedValue(undefined);
    const discardInterruptedCrawl = vi.fn();
    const value = session({ interruptedCrawl: null, resumeInterruptedCrawl, discardInterruptedCrawl });
    const view = render(<CrawlResumePanel session={value} />);
    expect(screen.queryByRole('status')).toBeNull();
    view.rerender(<CrawlResumePanel session={session({ ...value, interruptedCrawl: {
      url: 'https://example.test/recover', limit: 10, startedAt: '2026-10-01T10:00:00Z',
      config: DEFAULT_CRAWL_CONFIG, environment: 'default', updatedAt: '2026-10-01T10:01:00Z',
      completedUrls: ['https://example.test/recover'], frontierUrls: [],
    } })} />);
    expect(screen.getByRole('status').textContent).toContain('https://example.test/recover');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('siteAudit.resumeCrawl') }));
    expect(resumeInterruptedCrawl).toHaveBeenCalledExactlyOnceWith();
    expect(discardInterruptedCrawl).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('siteAudit.discard') }));
    expect(discardInterruptedCrawl).toHaveBeenCalledTimes(1);
  });

it('excludes the current run from baseline options and passes the selected identity and matching mode', () => {
    const current = createCrawlRunFixture({ id: 'current' });
    const baseline = createCrawlRunFixture({ id: 'baseline', startUrl: 'https://baseline.example' });
    const setComparisonRunId = vi.fn();
    const updateComparisonByPath = vi.fn();
    const value = session({ comparisonByPath: false, comparisonRunId: '', crawlRuns: [current, baseline],
      selectedRun: current, crawlEnvironmentLabel: () => 'Production', setComparisonRunId, updateComparisonByPath });
    const view = render(<CrawlComparisonSelector session={value} />);
    const selector = screen.getByRole('combobox');
    expect([...selector.querySelectorAll('option')].map(option => option.value)).toEqual(['', 'baseline']);
    fireEvent.change(selector, { target: { value: 'baseline' } });
    expect(setComparisonRunId).toHaveBeenCalledExactlyOnceWith('baseline');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(updateComparisonByPath).toHaveBeenCalledExactlyOnceWith(true);
    view.rerender(<CrawlComparisonSelector session={session({ ...value, comparisonByPath: true })} />);
    expect(screen.getByText(i18n.t('siteAudit.crawlComparisonPathMode'))).toBeTruthy();
  });

it('protects the built-in template and exposes custom template selection, creation and deletion', () => {
    const custom = { ...DEFAULT_CRAWL_REPORT_TEMPLATE, id: 'custom', name: 'Client report', builtIn: false };
    const callbacks = { selectReportTemplate: vi.fn(), setReportTemplateName: vi.fn(), createReportTemplate: vi.fn(), removeReportTemplate: vi.fn() };
    const value = session({ ...callbacks, reportTemplateName: '', reportTemplates: [DEFAULT_CRAWL_REPORT_TEMPLATE, custom], selectedReportTemplate: DEFAULT_CRAWL_REPORT_TEMPLATE });
    const view = render(<CrawlReportTemplateSelector session={value} />);
    expect(screen.queryByRole('button', { name: i18n.t('siteAudit.remove') })).toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });
    expect(callbacks.selectReportTemplate).toHaveBeenCalledExactlyOnceWith('custom');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Quarterly report' } });
    expect(callbacks.setReportTemplateName).toHaveBeenCalledExactlyOnceWith('Quarterly report');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('siteAudit.saveAsNew') }));
    expect(callbacks.createReportTemplate).toHaveBeenCalledTimes(1);
    view.rerender(<CrawlReportTemplateSelector session={session({ ...value, selectedReportTemplate: custom })} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('siteAudit.remove') }));
    expect(callbacks.removeReportTemplate).toHaveBeenCalledTimes(1);
  });

it('bounds rendering waits and scroll work while warning about unsupported transport overrides', () => {
    const setCrawlConfig = vi.fn();
    const value = session({ crawlConfig: DEFAULT_CRAWL_CONFIG, renderedProfileHasTransportOverrides: true, setCrawlConfig });
    const view = render(<CrawlRenderOptions session={value} />);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '#loaded' } });
    expect(setCrawlConfig).toHaveBeenLastCalledWith({ renderWaitForSelector: '#loaded' });
    const delay = screen.getByRole('spinbutton', { name: i18n.t('siteAudit.renderDelayAria') });
    const scroll = screen.getByRole('spinbutton', { name: i18n.t('siteAudit.lazyScrollAria') });
    for (const [input, field, maximum] of [[delay, 'renderWaitDelayMs', 10000], [scroll, 'renderLazyScrollCycles', 40]] as const) {
      for (const [entered, expected] of [['-5', 0], ['99999', maximum], ['', 0], ['3', 3]] as const) {
        fireEvent.change(input, { target: { value: entered } });
        expect(setCrawlConfig).toHaveBeenLastCalledWith({ [field]: expected });
      }
    }
    view.rerender(<CrawlRenderOptions session={session({ ...value, crawlConfig: { ...DEFAULT_CRAWL_CONFIG, requestProfileId: 'proxy-profile' } })} />);
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('siteAudit.renderProfileWarning'));
    view.rerender(<CrawlRenderOptions session={session({ ...value, renderedProfileHasTransportOverrides: false })} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

it('exports the selected immutable snapshot in every format and hides exports without a selected run', () => {
    const selectedRun = createCrawlRunFixture();
    const exportCrawlPdf = vi.fn().mockResolvedValue(undefined);
    const value = session({ selectedRun: undefined, selectedReportTemplate: DEFAULT_CRAWL_REPORT_TEMPLATE, exportCrawlPdf });
    const view = render(<CrawlExportActions session={value} />);
    expect(screen.queryByRole('button')).toBeNull();
    view.rerender(<CrawlExportActions session={session({ ...value, selectedRun })} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('crawlDeepUi.exportJson') }));
    expect(exports.downloadCrawlJson).toHaveBeenCalledExactlyOnceWith(selectedRun, DEFAULT_CRAWL_REPORT_TEMPLATE);
    for (const [label, action] of [
      ['siteAudit.urlCsv', exports.downloadCrawlPagesCsv], ['siteAudit.linksCsv', exports.downloadCrawlLinksCsv],
      ['siteAudit.imagesCsv', exports.downloadCrawlImagesCsv], ['siteAudit.resourcesCsv', exports.downloadCrawlResourcesCsv],
      ['siteAudit.issuesCsv', exports.downloadCrawlIssuesCsv],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: i18n.t(label) }));
      expect(action).toHaveBeenCalledExactlyOnceWith(selectedRun);
    }
    fireEvent.click(screen.getByRole('button', { name: i18n.t('crawlDeepUi.exportPdf') }));
    expect(exportCrawlPdf).toHaveBeenCalledExactlyOnceWith();
  });
});
