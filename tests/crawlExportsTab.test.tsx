import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlExportsTab } from '@/components/Domain/crawlResults/CrawlExportsTab';

const exp = vi.hoisted(() => ({
  downloadCrawlJson: vi.fn(),
  downloadCrawlPagesCsv: vi.fn(),
  downloadCrawlLinksCsv: vi.fn(),
  downloadCrawlImagesCsv: vi.fn(),
  downloadCrawlFramesCsv: vi.fn(),
  downloadCrawlCustomSearchCsv: vi.fn(),
  downloadCrawlResourcesCsv: vi.fn(),
  downloadCrawlIssuesCsv: vi.fn(),
}));
vi.mock('@/services/export', () => exp);

const run = { id: 'run-7', completedAt: '2026-03-04T10:20:00', startUrl: 'https://site.test/' };
const render_ = (over: Record<string, unknown> = {}) => {
  const exportPdf = vi.fn();
  const session = { currentRun: run, exportPdf, pdfError: null, t: i18n.t.bind(i18n), ...over };
  render(<CrawlExportsTab session={session as never} />);
  return exportPdf;
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  Object.values(exp).forEach((fn) => fn.mockReset());
});

describe('CrawlExportsTab', () => {
  it('shows the incomplete-run placeholder without a run', () => {
    render_({ currentRun: null });
    expect(screen.getByText(i18n.t('crawlDeepUi.incompleteRunExport'))).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('describes the saved run', () => {
    render_();
    const text = i18n.t('crawlDeepUi.exportRunDescription', { id: 'run-7', date: '2026-03-04 10:20', url: run.startUrl });
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['exportJson', 'downloadCrawlJson'],
    ['exportUrlsCsv', 'downloadCrawlPagesCsv'],
    ['exportLinksCsv', 'downloadCrawlLinksCsv'],
    ['exportImagesCsv', 'downloadCrawlImagesCsv'],
    ['exportFramesCsv', 'downloadCrawlFramesCsv'],
    ['exportCustomSearchCsv', 'downloadCrawlCustomSearchCsv'],
    ['exportResourcesCsv', 'downloadCrawlResourcesCsv'],
    ['exportIssuesCsv', 'downloadCrawlIssuesCsv'],
  ] as const)('the %s button downloads only through %s', (key, fn) => {
    render_();
    fireEvent.click(screen.getByRole('button', { name: i18n.t(`crawlDeepUi.${key}`) }));
    expect(exp[fn]).toHaveBeenCalledWith(run);
    const others = Object.entries(exp).filter(([name]) => name !== fn);
    expect(others.every(([, mock]) => mock.mock.calls.length === 0)).toBe(true);
  });

  it('exports the PDF through the session and shows its error', () => {
    const exportPdf = render_({ pdfError: 'PDF failed' });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('crawlDeepUi.exportPdf') }));
    expect(exportPdf).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toBe('PDF failed');
  });
});
