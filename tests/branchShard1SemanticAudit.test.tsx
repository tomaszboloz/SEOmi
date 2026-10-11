import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SemanticAuditPanel } from '@/components/Charts/SemanticAuditPanel';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { buildSemanticAudit } from '@/services/semanticAudit';
import { compareSemanticRuns } from '@/services/semanticRunComparison';
import type { SemanticAuditReport } from '@/services/topicalAudit/types';
import type { SemanticRunComparisonReport } from '@/services/semanticRunComparison';
import { createCrawlRunFixture } from './fixtures/crawl';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return { ...actual, useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => (options?.reasons ? `${key}|${String(options.reasons)}` : key) }) };
});
vi.mock('@/services/semanticAudit', () => ({ buildSemanticAudit: vi.fn() }));
vi.mock('@/services/semanticRunComparison', () => ({ compareSemanticRuns: vi.fn() }));

const report: SemanticAuditReport = {
  mappedTopics: 0, totalTopics: 0, mappedPages: 0, totalPages: 0, contentOrphanPages: null, truncated: false, entityObservability: [], findings: [],
};
const comparison: SemanticRunComparisonReport = {
  baselineRunId: 'baseline', currentRunId: 'current', truncated: false, changes: [],
  counts: {
    'url-added': 0, 'url-not-observed': 0, 'content-terms-changed': 0, 'content-link-added': 0, 'content-link-not-observed': 0,
    'topic-edge-added': 0, 'topic-edge-not-observed': 0, 'topic-url-coverage-changed': 0, 'query-term-observation-changed': 0,
  },
};

describe('SemanticAuditPanel comparison guard reasons', () => {
  beforeEach(() => {
    vi.mocked(buildSemanticAudit).mockReturnValue(report);
    vi.mocked(compareSemanticRuns).mockReturnValue(comparison);
  });

  it('lists every blocking reason of a guard computed from mismatched runs', () => {
    const baseline = createCrawlRunFixture({ id: 'baseline', startUrl: 'https://other.test/', completedAt: '2026-10-01' });
    const current = createCrawlRunFixture({ id: 'current', startUrl: 'https://site.test/', completedAt: '2026-10-03' });
    render(<SemanticAuditPanel document={createEmptyTopicalMap()} pages={[]} runs={[baseline, current]} currentRunId="current" />);
    const guard = screen.getByTestId('semantic-comparison-guard');
    expect(guard.textContent).toMatch(/siteAudit\.comparisonReasons\.[a-z-]+/);
    expect(guard.textContent).not.toContain('none');
  });
});
