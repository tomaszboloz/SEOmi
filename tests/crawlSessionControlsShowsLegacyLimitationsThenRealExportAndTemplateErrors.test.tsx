import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';

import { CrawlRunResults } from '@/components/Domain/siteAudit/CrawlRunResults';
import { CrawlLegacyHistory } from '@/components/Domain/siteAudit/CrawlLegacyHistory';

import { DEFAULT_CRAWL_REPORT_TEMPLATE, REPORT_TEMPLATE_SECTIONS } from '@/services/reportTemplates';

import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
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
