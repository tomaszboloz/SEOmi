import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrawlRunComparison } from '@/components/Domain/siteAudit/CrawlRunComparison';
import { session } from './fixtures/crawlSessionControlsContracts';

describe('crawl comparison guard UI', () => {
  it('exposes blocked status, reason and persisted run provenance', () => {
    const value = session({ comparison: {
      added: [], removed: [], changed: [], status: 'blocked', reasons: ['different-project'],
      provenance: {
        source: 'stored-crawl-runs', scopeMatched: false, projectId: 'project-a',
        current: { runId: 'current', completedAt: '2026-10-07T00:00:00Z', startUrl: 'https://example.test/', scopeFingerprint: 'a', pageCount: 1, completeness: 'complete', partial: false, partialReasons: [], provenance: 'stored-crawl-run' },
        baseline: { runId: 'baseline', completedAt: '2026-10-06T00:00:00Z', startUrl: 'https://example.test/', scopeFingerprint: 'b', pageCount: 1, completeness: 'complete', partial: false, partialReasons: [], provenance: 'stored-crawl-run' },
      },
    } as never, comparisonRunId: '', comparisonByPath: false, crawlRuns: [], selectedRun: undefined,
      crawlEnvironmentLabel: () => 'Default', setComparisonRunId: () => undefined, updateComparisonByPath: () => undefined });
    render(<CrawlRunComparison session={value} />);
    const status = screen.getByTestId('crawl-comparison-guard');
    expect(status.textContent).toContain('blocked');
    expect(status.textContent).toContain('different-project');
    expect(status.textContent).toContain('current');
    expect(status.textContent).toContain('baseline');
    expect(screen.queryByText('siteAudit.comparisonNoDifferences')).toBeNull();
    expect(screen.queryByText('siteAudit.comparisonAdded')).toBeNull();
    expect(screen.queryByText('siteAudit.comparisonRemoved')).toBeNull();
    expect(screen.queryByText('siteAudit.comparisonChanged')).toBeNull();
  });
});
