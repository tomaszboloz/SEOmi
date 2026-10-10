import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CrawlExportActions } from '@/components/Domain/siteAudit/CrawlExportActions';
import { CrawlWorkspaceHeader } from '@/components/Domain/siteAudit/CrawlWorkspaceHeader';
import {
  downloadCrawlHtml,
  downloadCrawlImagesCsv,
  downloadCrawlIssuesCsv,
  downloadCrawlJson,
  downloadCrawlLinksCsv,
  downloadCrawlPagesCsv,
  downloadCrawlResourcesCsv,
} from '@/services/export';

vi.mock('@/services/export', () => ({
  downloadCrawlHtml: vi.fn(),
  downloadCrawlImagesCsv: vi.fn(),
  downloadCrawlIssuesCsv: vi.fn(),
  downloadCrawlJson: vi.fn(),
  downloadCrawlLinksCsv: vi.fn(),
  downloadCrawlPagesCsv: vi.fn(),
  downloadCrawlResourcesCsv: vi.fn(),
}));

describe('CrawlExportActions coverage edges', () => {
  const t = ((k: string) => k) as any;

  it('returns null when selectedRun is missing', () => {
    const session = { selectedRun: null, t } as any;
    const { container } = render(<CrawlExportActions session={session} />);
    expect(container.firstChild).toBeNull();
  });

  it('triggers all 8 download handlers including html export', () => {
    const exportCrawlPdf = vi.fn();
    const selectedRun = { id: 'run-123' } as any;
    const selectedReportTemplate = { id: 'tpl-1' } as any;
    const session = {
      selectedRun,
      selectedReportTemplate,
      exportCrawlPdf,
      t,
    } as any;

    render(<CrawlExportActions session={session} />);

    fireEvent.click(screen.getByText('crawlDeepUi.exportJson'));
    expect(downloadCrawlJson).toHaveBeenCalledWith(selectedRun, selectedReportTemplate);

    fireEvent.click(screen.getByText('crawlDeepUi.exportPdf'));
    expect(exportCrawlPdf).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('crawlDeepUi.exportHtml'));
    expect(downloadCrawlHtml).toHaveBeenCalledWith(selectedRun, selectedReportTemplate);

    fireEvent.click(screen.getByText('siteAudit.urlCsv'));
    expect(downloadCrawlPagesCsv).toHaveBeenCalledWith(selectedRun);

    fireEvent.click(screen.getByText('siteAudit.linksCsv'));
    expect(downloadCrawlLinksCsv).toHaveBeenCalledWith(selectedRun);

    fireEvent.click(screen.getByText('siteAudit.imagesCsv'));
    expect(downloadCrawlImagesCsv).toHaveBeenCalledWith(selectedRun);

    fireEvent.click(screen.getByText('siteAudit.resourcesCsv'));
    expect(downloadCrawlResourcesCsv).toHaveBeenCalledWith(selectedRun);

    fireEvent.click(screen.getByText('siteAudit.issuesCsv'));
    expect(downloadCrawlIssuesCsv).toHaveBeenCalledWith(selectedRun);
  });
});

describe('CrawlWorkspaceHeader coverage edges', () => {
  const t = ((k: string, opts?: { count?: number }) => (opts?.count != null ? `${k}:${opts.count}` : k)) as any;

  it('renders without map navigation when crawlResult is null', () => {
    const session = { crawlResult: null, setMapNavigationRequest: vi.fn(), t } as any;
    const { container } = render(<CrawlWorkspaceHeader session={session} />);
    expect(screen.getByText('siteAudit.headerBadge')).toBeTruthy();
    expect(container.querySelector('nav')).toBeNull();
  });

  it('executes both map button navigation updater callbacks including nav button', () => {
    const setMapNavigationRequest = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') updater(10);
    });
    const session = {
      crawlResult: { pages_crawled: 15 },
      setMapNavigationRequest,
      t,
    } as any;

    render(<CrawlWorkspaceHeader session={session} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2);

    fireEvent.click(buttons[0]);
    expect(setMapNavigationRequest).toHaveBeenCalled();
    const updater0 = setMapNavigationRequest.mock.calls[0][0] as (r: number) => number;
    expect(updater0(5)).toBe(6);

    fireEvent.click(buttons[1]);
    expect(setMapNavigationRequest).toHaveBeenCalledTimes(2);
    const updater1 = setMapNavigationRequest.mock.calls[1][0] as (r: number) => number;
    expect(updater1(5)).toBe(6);
  });
});
