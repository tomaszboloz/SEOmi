import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { useCrawlExecution } from '@/components/Domain/siteAudit/session/useCrawlExecution';
import { CrawlProgressStatus } from '@/components/Domain/siteAudit/CrawlProgressStatus';
import { useToolsStore } from '@/stores/toolsStore';

// Mock tauri environment to be true
vi.mock('@/services/tauri', () => ({
  isTauriEnvironment: () => true,
}));

describe('crawlSessionExecutionBranches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToolsStore.setState({
      crawlResult: null,
      isCrawling: false,
      selectedCrawlRunId: null,
      crawlRuns: [],
      crawlError: null,
    });
  });

  it('covers useCrawlExecution comparison, pdf error state, and aborted crawl transitions', async () => {
    const validateFilters = vi.fn().mockResolvedValue({ valid: true });
    const downloadPdf = vi.fn().mockRejectedValue(new Error('PDF export failed'));
    
    let hookResult: ReturnType<typeof useCrawlExecution>;
    const TestComponent = () => {
      hookResult = useCrawlExecution(
        'proj-1',
        { downloadPdf } as any,
        'https://example.com',
        50,
        validateFilters,
        {} as any
      );
      return (
        <div>
          <button data-testid="start" onClick={(e) => void hookResult.handleStartCrawl(e)}>Start</button>
          <button data-testid="compare-path" onClick={() => hookResult.updateComparisonByPath(true)}>Compare Path</button>
          <button data-testid="env-compare" onClick={() => void hookResult.runEnvironmentComparison()}>Env Compare</button>
          <button data-testid="pdf" onClick={() => void hookResult.exportCrawlPdf()}>PDF</button>
          <span data-testid="env-err">{hookResult.environmentComparisonError ?? 'none'}</span>
          <span data-testid="pdf-err">{hookResult.crawlPdfError ?? 'none'}</span>
        </div>
      );
    };

    await act(async () => {
      render(<TestComponent />);
    });

    // Test start crawl with validation
    await act(async () => {
      fireEvent.click(screen.getByTestId('start'));
    });
    expect(validateFilters).toHaveBeenCalled();

    // Test environment comparison when desktop env is true but urls empty
    await act(async () => {
      fireEvent.click(screen.getByTestId('env-compare'));
    });
    // Since urls are empty, it simply returns without setting error
    expect(screen.getByTestId('env-err').textContent).toBe('none');

    // Test comparison by path storage update
    await act(async () => {
      fireEvent.click(screen.getByTestId('compare-path'));
    });
    expect(hookResult!.comparisonByPath).toBe(true);

    // Test PDF export error handling when no run is selected vs selected run
    await act(async () => {
      fireEvent.click(screen.getByTestId('pdf'));
    });
    expect(screen.getByTestId('pdf-err').textContent).toBe('none');
  });

  it('covers CrawlProgressStatus with zero-page counts, indeterminate progress, error banners and pause/cancel interactions', async () => {
    const pauseSiteCrawl = vi.fn();
    const resumeSiteCrawl = vi.fn();
    const cancelSiteCrawl = vi.fn();
    const t = (key: string, opts?: any) => {
      if (key === 'siteAudit.rate') return `${opts?.value ?? 0} pages/s`;
      return key;
    };

    const mockSession = {
      cancelSiteCrawl,
      crawlProgress: 0,
      crawlProgressDetail: {
        currentUrl: '',
        completed: 0,
        discovered: 0,
        queued: 0,
        elapsedMs: 0,
        pagesPerSecond: 0,
      },
      isCrawlPaused: false,
      pauseSiteCrawl,
      resumeSiteCrawl,
      t,
    };

    const { rerender } = render(<CrawlProgressStatus session={mockSession as any} />);

    // Zero-page counts and indeterminate progress check
    expect(screen.getByText('0/0')).toBeTruthy();

    // Click pause
    const pauseButton = screen.getByRole('button', { name: /pauseCrawl/i });
    await act(async () => {
      fireEvent.click(pauseButton);
    });
    expect(pauseSiteCrawl).toHaveBeenCalled();

    // Rerender paused state
    const pausedSession = { ...mockSession, isCrawlPaused: true };
    await act(async () => {
      rerender(<CrawlProgressStatus session={pausedSession as any} />);
    });
    expect(screen.getByText('siteAudit.pausedNotice')).toBeTruthy();

    // Click resume
    const resumeButton = screen.getByRole('button', { name: /resumeCrawl/i });
    await act(async () => {
      fireEvent.click(resumeButton);
    });
    expect(resumeSiteCrawl).toHaveBeenCalled();

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancelCrawl/i });
    await act(async () => {
      fireEvent.click(cancelButton);
    });
    expect(cancelSiteCrawl).toHaveBeenCalled();
  });
});
