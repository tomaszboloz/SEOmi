import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';

import { CrawlResultsOverview } from '@/components/Domain/siteAudit/CrawlResultsOverview';
import { CrawlHealthMetrics } from '@/components/Domain/siteAudit/CrawlHealthMetrics';
import { CrawlResourceRows } from '@/components/Domain/siteAudit/CrawlResourceRows';
import { CrawlComparisonDetails } from '@/components/Domain/siteAudit/CrawlComparisonDetails';
import { CrawlRunComparison } from '@/components/Domain/siteAudit/CrawlRunComparison';
import { CrawlResourceErrors } from '@/components/Domain/siteAudit/CrawlResourceErrors';
import { CrawlPageErrors } from '@/components/Domain/siteAudit/CrawlPageErrors';

import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import { Session, session } from "./fixtures/crawlSessionControlsContracts";
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
});
