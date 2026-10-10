import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlCompareRunsSection } from '@/components/Domain/crawlResults/visualisationsTab/CrawlCompareRunsSection';
import type { CrawlRunRecord } from '@/types';
import type { CrawlDiff, CrawlDiffReport } from '@/services/crawlDiff';

const mockT = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const sampleRuns: CrawlRunRecord[] = [
  { id: 'run-1', completedAt: '2026-09-01T10:00:00Z', startUrl: 'https://a.test', result: { pages_crawled: 5 } } as CrawlRunRecord,
  { id: 'run-2', completedAt: '2026-09-02T10:00:00Z', startUrl: 'https://b.test', result: { pages_crawled: 8 } } as CrawlRunRecord,
];

const evidence = (runId: string) => ({ runId, completedAt: '2026-09-01T10:00:00Z', startUrl: 'https://a.test', scopeFingerprint: 'same-scope', pageCount: 5, completeness: 'complete' as const, partial: false, partialReasons: [], provenance: 'stored-crawl-run' as const });
const provenance: CrawlDiffReport['provenance'] = { source: 'stored-crawl-runs', scopeMatched: true, baseline: evidence('run-1'), current: evidence('run-2') };

const defaultProps = {
  runs: sampleRuns,
  comparisonRunId: '',
  setComparisonRunId: vi.fn(),
  compareByPath: false,
  updateCompareByPath: vi.fn(),
  comparison: null,
  t: mockT,
};

describe('CrawlCompareRunsSection branches', () => {
  it('returns null when runs has 1 or fewer items', () => {
    const { container: c1 } = render(<CrawlCompareRunsSection {...defaultProps} runs={[]} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<CrawlCompareRunsSection {...defaultProps} runs={[sampleRuns[0]]} />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders path match description and disclaimer when compareByPath is true', () => {
    render(<CrawlCompareRunsSection {...defaultProps} compareByPath={true} />);
    expect(screen.getByText('crawlDeepUi.environmentMatchDescription')).toBeDefined();
    expect(screen.getByRole('note').textContent).toContain('crawlDeepUi.pathMatchDisclaimer');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('renders metrics and list without guard banner for plain CrawlDiff', () => {
    const comparison: CrawlDiff = {
      added: [{ kind: 'added', url: 'https://a.test/add', fields: [] }],
      removed: [{ kind: 'removed', url: 'https://a.test/rem', fields: [] }],
      changed: [],
    };
    render(<CrawlCompareRunsSection {...defaultProps} currentRunId="run-1" comparison={comparison} />);
    expect(screen.queryByTestId('crawl-results-comparison-guard')).toBeNull();
    expect(screen.getByText('crawlDeepUi.addedUrls')).toBeDefined();
    expect(screen.getByText('crawlDeepUi.removedUrls')).toBeDefined();
    expect(screen.getByText('crawlDeepUi.changedUrls')).toBeDefined();
  });

  it('renders guard banner and metrics for CrawlDiffReport with non-blocked status', () => {
    const report: CrawlDiffReport = {
      status: 'partial',
      reasons: ['low_volume'],
      added: [],
      removed: [],
      changed: [],
      provenance,
    };
    render(<CrawlCompareRunsSection {...defaultProps} currentRunId="run-1" comparison={report} />);
    const guard = screen.getByTestId('crawl-results-comparison-guard');
    expect(guard.textContent).toContain('partial');
    expect(guard.textContent).toContain('siteAudit.comparisonReasons.low_volume');
    expect(screen.getByText('crawlDeepUi.addedUrls')).toBeDefined();
  });

  it('suppresses metrics when CrawlDiffReport status is blocked', () => {
    const blocked: CrawlDiffReport = {
      status: 'blocked',
      reasons: ['scope_mismatch'],
      added: [{ kind: 'added', url: 'https://a.test/add', fields: [] }],
      removed: [],
      changed: [],
      provenance,
    };
    render(<CrawlCompareRunsSection {...defaultProps} currentRunId="run-1" comparison={blocked} />);
    expect(screen.getByTestId('crawl-results-comparison-guard')).toBeDefined();
    expect(screen.queryByText('crawlDeepUi.addedUrls')).toBeNull();
  });

  it('falls back to none when CrawlDiffReport has empty reasons', () => {
    const emptyReasons: CrawlDiffReport = {
      status: 'partial',
      reasons: [],
      added: [],
      removed: [],
      changed: [],
      provenance,
    };
    render(<CrawlCompareRunsSection {...defaultProps} currentRunId="run-1" comparison={emptyReasons} />);
    expect(screen.getByTestId('crawl-results-comparison-guard').textContent).toContain('none []');
  });
});
