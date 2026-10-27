import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import type { TFunction } from 'i18next';
import type { CrawledPageIssue, CrawlRunRecord, SiteCrawlResult } from '@/types';
import { CrawlExportsTab } from '@/components/Domain/crawlResults/CrawlExportsTab';
import { CustomSearchConfigCards } from '@/components/Domain/crawlResults/customSearch/CustomSearchConfigCards';
import { CrawlPageEvidenceIssues } from '@/components/Domain/crawlResults/pageTable/CrawlPageEvidenceIssues';
import { calculateTimingMetrics } from '@/components/Domain/crawlResults/performanceTab/performanceHelpers';
import { useCrawlResultsSession, type CrawlResultsDependencies } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import { useProjectStore } from '@/stores/projectStore';

const t = i18n.t.bind(i18n) as unknown as TFunction;

describe('CrawlExportsTab completion label', () => {
  it('shows a dash when the run completion timestamp is not a valid date', () => {
    const session = {
      currentRun: { id: 'run-1', completedAt: 'not-a-date', startUrl: 'https://a.test/' },
      exportPdf: vi.fn(), pdfError: '', t,
    } as unknown as Parameters<typeof CrawlExportsTab>[0]['session'];
    render(<CrawlExportsTab session={session} />);
    expect(screen.getByText(t('crawlDeepUi.exportRunDescription', { id: 'run-1', date: '—', url: 'https://a.test/' }) as string)).toBeTruthy();
  });
});

describe('CustomSearchConfigCards', () => {
  it('falls back to the generic attribute label when an attribute search has no attribute name', () => {
    const tt = (key: string) => i18n.t(key) as string;
    render(<CustomSearchConfigCards t={tt} searches={[{ id: 's1', name: 'Find', query: 'a', selectorType: 'css', resultType: 'attribute' }]} />);
    expect(screen.getByText((content) => content.includes(`(${i18n.t('crawl.customSearch.attribute')})`))).toBeTruthy();
  });
});

describe('CrawlPageEvidenceIssues', () => {
  it('labels an issue without a severity as a warning', () => {
    const issue = { code: 'x', message: 'Something is off' } as unknown as CrawledPageIssue;
    render(<CrawlPageEvidenceIssues issues={[issue]} t={t} />);
    expect(screen.getByText(`${t('crawl.ui.severityValues.warning')}:`)).toBeTruthy();
  });
});

describe('calculateTimingMetrics', () => {
  it('has no median when no page reports a valid response time', () => {
    const metrics = calculateTimingMetrics([{ response_time_ms: Number.NaN }, { response_time_ms: -5 }] as never, t);
    expect(metrics.timings).toEqual([]);
    expect(metrics.median).toBeUndefined();
  });
});

describe('useCrawlResultsSession fallbacks', () => {
  const mkResult = (urls: string[]) => ({
    start_url: 'https://a.test/', sitemap_urls: [],
    pages: urls.map((url) => ({ url, final_url: url, issues: [], links: [], images: [], hreflangs: [], schema_types: [], schema_syntax_errors: 0, redirect_chain: [] })),
  }) as unknown as SiteCrawlResult;
  const mkRun = (id: string, result: SiteCrawlResult) => ({ id, completedAt: '2026-01-01T00:00:00Z', startUrl: result.start_url, result, config: {} }) as unknown as CrawlRunRecord;
  const current = mkRun('run-a', mkResult(['https://a.test/']));
  const older = mkRun('run-old', mkResult(['https://a.test/']));
  const deps = (): CrawlResultsDependencies => ({ captureArtifact: vi.fn(), downloadArtifact: vi.fn(), exportPdf: vi.fn(), copyText: vi.fn() });
  const setup = () => renderHook(() => useCrawlResultsSession({ result: current.result, runs: [current, older], selectedRun: current, onSelectRun: vi.fn() } as never, deps()));

  beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

  it('compares runs without a project and falls back to the first tab and group for unknown ids', () => {
    useProjectStore.setState({ activeProjectId: null } as never);
    const { result } = setup();
    act(() => result.current.setComparisonRunId('run-old'));
    expect(result.current.comparison).not.toBeNull();
    act(() => { result.current.setActiveTab('unknown-tab' as never); result.current.setActiveTabGroup('unknown-group' as never); });
    expect(result.current.activeTabMeta).toBeTruthy();
    expect(result.current.activeTabMeta.id).not.toBe('unknown-tab');
    expect(result.current.activeGroupMeta.id).not.toBe('unknown-group');
  });
});
