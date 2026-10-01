import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlWorkspaceNavigation } from '@/components/Domain/siteAudit/CrawlWorkspaceNavigation';
import { CrawlResumePanel } from '@/components/Domain/siteAudit/CrawlResumePanel';
import { CrawlComparisonSelector } from '@/components/Domain/siteAudit/CrawlComparisonSelector';
import { CrawlReportTemplateSelector } from '@/components/Domain/siteAudit/CrawlReportTemplateSelector';
import { CrawlRenderOptions } from '@/components/Domain/siteAudit/CrawlRenderOptions';
import { CrawlExportActions } from '@/components/Domain/siteAudit/CrawlExportActions';
import { CrawlResultsOverview } from '@/components/Domain/siteAudit/CrawlResultsOverview';
import { CrawlHealthMetrics } from '@/components/Domain/siteAudit/CrawlHealthMetrics';
import { CrawlResourceRows } from '@/components/Domain/siteAudit/CrawlResourceRows';
import { CrawlComparisonDetails } from '@/components/Domain/siteAudit/CrawlComparisonDetails';
import { CrawlRunComparison } from '@/components/Domain/siteAudit/CrawlRunComparison';
import { CrawlResourceErrors } from '@/components/Domain/siteAudit/CrawlResourceErrors';
import { CrawlPageErrors } from '@/components/Domain/siteAudit/CrawlPageErrors';
import { CrawlRunResults } from '@/components/Domain/siteAudit/CrawlRunResults';
import { CrawlLegacyHistory } from '@/components/Domain/siteAudit/CrawlLegacyHistory';
import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { DEFAULT_CRAWL_REPORT_TEMPLATE, REPORT_TEMPLATE_SECTIONS } from '@/services/reportTemplates';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const exports = vi.hoisted(() => ({
  downloadCrawlJson: vi.fn(), downloadCrawlPagesCsv: vi.fn(), downloadCrawlLinksCsv: vi.fn(),
  downloadCrawlImagesCsv: vi.fn(), downloadCrawlResourcesCsv: vi.fn(), downloadCrawlIssuesCsv: vi.fn(),
}));
vi.mock('@/services/export', () => exports);

type Session = ReturnType<typeof useSiteAuditSession>;
const session = (patch: Partial<Session>): Session => ({ t: i18n.t.bind(i18n), ...patch } as Session);

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

  it('exposes every severity and only the available error categories for the filtered page inventory', () => {
    const setSeverityFilter = vi.fn();
    const setErrorKindFilter = vi.fn();
    render(<CrawlResultsOverview session={session({ filteredPages: [createCrawlPageFixture()], severityFilter: 'all',
      activeErrorKindFilter: 'all', availableErrorKinds: ['dns', 'http'], setSeverityFilter, setErrorKindFilter })} />);
    expect(screen.getByRole('heading').textContent).toBe(i18n.t('siteAudit.pagesInventory', { count: 1 }));
    for (const mode of ['all', 'Critical', 'Warning', 'Info'] as const) {
      fireEvent.click(screen.getByRole('button', { name: mode === 'all' ? i18n.t('siteAudit.allPages') : i18n.t(`siteAudit.severityValues.${mode}`) }));
      expect(setSeverityFilter).toHaveBeenLastCalledWith(mode);
    }
    const selector = screen.getByRole('combobox');
    expect([...selector.querySelectorAll('option')].map(option => option.value)).toEqual(['all', 'dns', 'http']);
    fireEvent.change(selector, { target: { value: 'dns' } });
    expect(setErrorKindFilter).toHaveBeenCalledExactlyOnceWith('dns');
  });

  it('shows only observed crawl metrics and no summary before a result exists', () => {
    const view = render(<CrawlHealthMetrics session={session({ crawlResult: null })} />);
    expect(view.container.textContent).toBe('');
    view.rerender(<CrawlHealthMetrics session={session({ crawlResult: createCrawlResultFixture({
      health_score: 73, pages_crawled: 27, critical_count: 4, warning_count: 9, duration_ms: 156,
    }) })} />);
    for (const value of ['73 / 100', '27', '4', '9', `156 ${i18n.t('performance.milliseconds')}`]) {
      expect(screen.getByText(value)).toBeTruthy();
    }
  });

  it('distinguishes HTTP errors, failed transport and absent dimension evidence in resource rows', () => {
    const base = { resource_type: 'image', source_urls: ['https://example.test/'] };
    const resources = [
      { ...base, url: 'https://example.test/image.png', http_status: 200, content_type: 'image/png', content_length: 123,
        intrinsic_width: 80, intrinsic_height: 40, dimensions_source: 'decoded' },
      { ...base, url: 'https://example.test/missing.png', http_status: 404 },
      { ...base, url: 'https://example.test/tls.png', request_error_kind: 'tls' },
      { ...base, url: 'https://example.test/unknown.png' },
    ] as Session['filteredResources'];
    render(<table><CrawlResourceRows session={session({ filteredResources: resources })} /></table>);
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText('80 × 40 · decoded')).toBeTruthy();
    expect(rows[0].textContent).toContain('123 B');
    expect(within(rows[1]).getByText(i18n.t('crawl.ui.httpStatus', { status: 404 }))).toBeTruthy();
    expect(within(rows[2]).getByText('tls')).toBeTruthy();
    expect(within(rows[3]).getByText(i18n.t('siteAudit.requestError'))).toBeTruthy();
    expect(within(rows[3]).getByText('—')).toBeTruthy();
  });

  it('retains changed fields and both environment URLs in comparison details', () => {
    const value = session({ comparison: null });
    const view = render(<CrawlComparisonDetails session={value} />);
    expect(view.container.textContent).toBe('');
    view.rerender(<CrawlComparisonDetails session={session({ comparison: { added: [], removed: [], changed: [] } })} />);
    expect(screen.getByText(i18n.t('siteAudit.comparisonNoDifferences'))).toBeTruthy();
    view.rerender(<CrawlComparisonDetails session={session({ comparison: {
      added: [{ kind: 'added', url: 'https://example.test/new', fields: [] }],
      removed: [{ kind: 'removed', url: 'https://example.test/old', fields: [] }],
      changed: [{ kind: 'changed', url: 'https://example.test/product', matchedUrl: 'https://staging.example/product', fields: ['HTTP status', 'Title'] }],
    } })} />);
    expect(screen.getByText(/https:\/\/example.test\/new/).textContent).toContain(i18n.t('siteAudit.comparisonAddedLabel'));
    expect(screen.getByText(/https:\/\/example.test\/old/).textContent).toContain(i18n.t('siteAudit.comparisonRemovedLabel'));
    const changed = screen.getByText(/https:\/\/example.test\/product/).textContent;
    expect(changed).toContain('↔ https://staging.example/product');
    expect(changed).toContain('(HTTP status, Title)');
  });

  it('shows the path-matching qualification only when origins are deliberately ignored', () => {
    const value = session({ comparison: { added: [], removed: [], changed: [] }, comparisonByPath: false,
      comparisonRunId: '', crawlRuns: [], selectedRun: undefined, crawlEnvironmentLabel: () => 'Default',
      setComparisonRunId: vi.fn(), updateComparisonByPath: vi.fn() });
    const view = render(<CrawlRunComparison session={value} />);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getAllByText('0')).toHaveLength(3);
    view.rerender(<CrawlRunComparison session={session({ ...value, comparisonByPath: true })} />);
    expect(screen.getByRole('note').textContent).toBe(i18n.t('siteAudit.comparisonPathNotice'));
  });

  it('distinguishes absent resource capture, captured emptiness and an empty error filter', () => {
    const value = session({ crawlResult: null, filteredResources: [], activeErrorKindFilter: 'dns' });
    const view = render(<CrawlResourceErrors session={value} />);
    expect(view.container.textContent).toBe('');
    view.rerender(<CrawlResourceErrors session={session({ ...value, crawlResult: createCrawlResultFixture({ resources: [] }) })} />);
    expect(screen.getByText(i18n.t('siteAudit.noResources'))).toBeTruthy();
    const resources = [{ resource_type: 'image', url: 'https://example.test/img.png', http_status: 200, source_urls: [] }] as Session['filteredResources'];
    view.rerender(<CrawlResourceErrors session={session({ ...value, crawlResult: createCrawlResultFixture({ resources, resource_limit_reached: true }) })} />);
    expect(screen.getByText(i18n.t('siteAudit.noFilteredResources', { error: i18n.t('crawl.ui.errorKinds.dns') }))).toBeTruthy();
    expect(screen.getByText(new RegExp(i18n.t('siteAudit.resourceLimitReached')))).toBeTruthy();
  });

  it('expands only the requested page and keeps incomplete or missing evidence explicit', () => {
    const toggleRow = vi.fn();
    const page = createCrawlPageFixture({ issues: [{ severity: 'Critical', message: 'Missing <title> tag' }], http_status: 503 });
    const value = session({ filteredPages: [page], expandedRows: {}, toggleRow });
    const view = render(<table><CrawlPageErrors session={value} /></table>);
    expect(screen.queryByText(i18n.t('siteAudit.identifiedIssues'))).toBeNull();
    fireEvent.click(screen.getByRole('row'));
    expect(toggleRow).toHaveBeenCalledExactlyOnceWith(page.url);
    view.rerender(<table><CrawlPageErrors session={session({ ...value, expandedRows: { [page.url]: true } })} /></table>);
    expect(screen.getByText(i18n.t('auditIssues.messages.meta_title_missing'))).toBeTruthy();
    expect(screen.getByText(i18n.t('siteAudit.contentUnavailable'))).toBeTruthy();
    expect(screen.getByText(i18n.t('siteAudit.noHtmlLanguage'))).toBeTruthy();
    expect(screen.getByText(i18n.t('siteAudit.completeBody'))).toBeTruthy();
    const enriched = createCrawlPageFixture({ ...page, body_truncated: true, title: 'Page title', title_length: 10,
      meta_description: 'Description', meta_description_length: 11, canonical: page.url, meta_robots: 'noindex', x_robots_tag: 'nofollow',
      content_type: 'text/html', content_hash: 'abcdefghijklmnop', content_simhash: '1234', word_count: 35,
      schema_types: ['Article'], schema_syntax_errors: 1, document_language: 'en', hreflangs: [{ language: 'pl', target_url: 'https://example.test/pl' }],
      amp_url: 'https://example.test/amp',
      images: [{ src: 'https://example.test/a.png', lazy_loaded: false }, { src: 'https://example.test/b.png', alt: '', lazy_loaded: false }, { src: 'https://example.test/c.png', alt: 'Cat', lazy_loaded: true }],
      links: [{ target_url: 'https://example.test/link', is_internal: true, target_http_status: 404, anchor_text: '' },
        { target_url: 'https://other.example', is_internal: false, target_http_status: 200, anchor_text: 'Other' },
        { target_url: 'https://example.test/pending', is_internal: true, anchor_text: 'Pending' }],
      redirect_chain: [{ from_url: 'https://example.test/before', to_url: page.url, http_status: 301 }],
    });
    view.rerender(<table><CrawlPageErrors session={session({ ...value, filteredPages: [enriched], expandedRows: { [page.url]: true } })} /></table>);
    expect(screen.getByText(i18n.t('siteAudit.truncatedBody'))).toBeTruthy();
    expect(screen.getByText(i18n.t('siteAudit.altMissing'))).toBeTruthy();
    expect(screen.getByText(i18n.t('siteAudit.altValue', { value: 'Cat' }))).toBeTruthy();
    expect(screen.getByText(i18n.t('siteAudit.notCheckedInRun'))).toBeTruthy();
    expect(screen.getByText(/abcdefghijkl/).textContent).toContain('1234');
    expect(screen.getByText(/https:\/\/example.test\/before/).textContent).toContain('301');
  });

  it('shows legacy limitations, then real export and template errors after a run is selected', () => {
    const result = createCrawlResultFixture({ cancelled: true, sitemap_urls_discovered: 2,
      rejected_urls: [{ url: 'http://localhost/private', reason: 'blocked target' }] });
    const value = session({ crawlResult: result, selectedRun: undefined, crawlOnlyUrls: [], sitemapOnlyUrls: ['https://example.test/sitemap'],
      crawlPdfError: null, reportTemplateError: null, selectedReportTemplate: DEFAULT_CRAWL_REPORT_TEMPLATE,
      reportTemplates: [DEFAULT_CRAWL_REPORT_TEMPLATE], reportTemplateName: '', reportTemplateSections: ['summary'],
      reportTemplateSectionLabels: Object.fromEntries(REPORT_TEMPLATE_SECTIONS.map(section => [section, section])) as Session['reportTemplateSectionLabels'],
      toggleReportTemplateSection: vi.fn(), createReportTemplate: vi.fn(), removeReportTemplate: vi.fn(), selectReportTemplate: vi.fn(), setReportTemplateName: vi.fn(),
      exportCrawlPdf: vi.fn(), filteredPages: [], expandedRows: {}, toggleRow: vi.fn(), severityFilter: 'all', activeErrorKindFilter: 'all',
      availableErrorKinds: [], setErrorKindFilter: vi.fn(), setSeverityFilter: vi.fn(), crawlRuns: [], historyMetrics: [],
    });
    const view = render(<CrawlRunResults session={session({ ...value, crawlResult: null })} />);
    expect(view.container.textContent).toBe('');
    view.rerender(<CrawlRunResults session={value} />);
    expect(screen.getByText(i18n.t('siteAudit.legacyExportUnavailable'))).toBeTruthy();
    expect(screen.getByText(i18n.t('siteAudit.cancelledNotice'))).toBeTruthy();
    expect(screen.getByText(/http:\/\/localhost\/private/).textContent).toContain('blocked target');
    view.rerender(<CrawlRunResults session={session({ ...value, selectedRun: createCrawlRunFixture({ result }),
      reportTemplateError: 'template save failed', crawlPdfError: 'PDF generation failed' })} />);
    expect(screen.getAllByRole('alert').map(alert => alert.textContent)).toEqual(['template save failed', 'PDF generation failed']);
    const configuration = screen.getByRole('checkbox', { name: 'configuration', hidden: true });
    fireEvent.click(configuration);
    expect(value.toggleReportTemplateSection).toHaveBeenCalledExactlyOnceWith('configuration');
    expect(screen.queryByRole('checkbox', { name: 'summary', hidden: true })).toBeNull();
    view.rerender(<CrawlLegacyHistory session={session({ ...value, crawlResult: null })} />);
    expect(view.container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(view.container.textContent).toBe('');
    view.rerender(<CrawlLegacyHistory session={session({ ...value, crawlResult: { ...result, resources: [] },
      crawlRuns: [createCrawlRunFixture({ id: 'old' }), createCrawlRunFixture({ id: 'new' })],
      historyMetrics: [{ label: 'Observed score', values: [10, 20], colour: 'text-white' }, { label: 'Unavailable metric', values: [], colour: 'text-white' }],
      comparison: null, comparisonByPath: false, comparisonRunId: '', crawlEnvironmentLabel: () => 'Default',
      setComparisonRunId: vi.fn(), updateComparisonByPath: vi.fn(),
    })} />);
    expect(view.container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Observed score').parentElement?.textContent).toContain('20');
    expect(screen.getByText('Unavailable metric').parentElement?.textContent).toContain('—');
    expect(screen.getByText(i18n.t('siteAudit.noResources'))).toBeTruthy();
  });
});
