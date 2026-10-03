import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlHistoryMetricsSection } from '@/components/Domain/crawlResults/visualisationsTab/CrawlHistoryMetricsSection';
import { ComparisonChangesList } from '@/components/Domain/crawlResults/visualisationsTab/ComparisonChangesList';
import { CrawlCompareRunsSection } from '@/components/Domain/crawlResults/visualisationsTab/CrawlCompareRunsSection';
import type { CrawlRunRecord } from '@/types';
import type { CrawlDiff } from '@/services/crawlDiff';

const mockT = (key: string, params?: Record<string, unknown>) => {
  if (params?.count !== undefined) return `${key}:${params.count}`;
  return key;
};

describe('CrawlVisualisationsTab submodules', () => {
  it('renders history empty state when runs <= 1 and metrics when runs > 1', () => {
    const { rerender } = render(
      <CrawlHistoryMetricsSection runsCount={1} historyMetrics={[]} t={mockT} />
    );
    expect(screen.getByText('crawlDeepUi.historyChartEmpty')).toBeDefined();

    rerender(
      <CrawlHistoryMetricsSection
        runsCount={2}
        historyMetrics={[{ label: 'Health Score', colour: 'text-emerald-400', values: [80, 90] }]}
        t={mockT}
      />
    );
    expect(screen.getByText('crawlDeepUi.savedRunMetrics')).toBeDefined();
    expect(screen.getByText('Health Score')).toBeDefined();
    expect(screen.getByText('90')).toBeDefined();
  });

  it('renders ComparisonChangesList with changes and handles empty', () => {
    const emptyComp: CrawlDiff = { added: [], removed: [], changed: [] };
    const { rerender } = render(<ComparisonChangesList comparison={emptyComp} t={mockT} />);
    expect(screen.getByText('crawlDeepUi.noComparisonChanges')).toBeDefined();

    const populatedComp: CrawlDiff = {
      added: [{ kind: 'added', url: 'https://example.com/new', fields: [] }],
      removed: [{ kind: 'removed', url: 'https://example.com/old', fields: [] }],
      changed: [{ kind: 'changed', url: 'https://example.com/mod', fields: ['title'], matchedUrl: 'https://example.com/mod' }],
    };
    rerender(<ComparisonChangesList comparison={populatedComp} t={mockT} />);
    expect(screen.getByText(/added · https:\/\/example\.com\/new/)).toBeDefined();
    expect(screen.getByText(/removed · https:\/\/example\.com\/old/)).toBeDefined();
    expect(screen.getByText(/changed · https:\/\/example\.com\/mod/)).toBeDefined();
  });

  it('renders CrawlCompareRunsSection and handles run selection and path toggle', () => {
    const runs: CrawlRunRecord[] = [
      { id: 'run1', completedAt: '2026-09-01T12:00:00Z', startUrl: 'https://example.com', result: { pages_crawled: 5 } } as CrawlRunRecord,
      { id: 'run2', completedAt: '2026-09-02T12:00:00Z', startUrl: 'https://example.com', result: { pages_crawled: 10 } } as CrawlRunRecord,
    ];
    const setComparisonRunId = vi.fn();
    const updateCompareByPath = vi.fn();

    render(
      <CrawlCompareRunsSection
        runs={runs}
        currentRunId="run1"
        comparisonRunId=""
        setComparisonRunId={setComparisonRunId}
        compareByPath={false}
        updateCompareByPath={updateCompareByPath}
        comparison={null}
        t={mockT}
      />
    );

    const select = screen.getByRole('combobox', { name: 'crawl.ui.compareCrawl' });
    fireEvent.change(select, { target: { value: 'run2' } });
    expect(setComparisonRunId).toHaveBeenCalledWith('run2');

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(updateCompareByPath).toHaveBeenCalledWith(true);
  });
});
