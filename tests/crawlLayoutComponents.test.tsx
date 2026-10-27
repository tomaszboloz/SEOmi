import type { ComponentType } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlResultsHeader } from '@/components/Domain/crawlResults/CrawlResultsHeader';
import { CrawlResultsGroups } from '@/components/Domain/crawlResults/CrawlResultsGroups';
import { CrawlResultsTabStrip } from '@/components/Domain/crawlResults/CrawlResultsTabStrip';
import { CrawlResultsNavigation } from '@/components/Domain/crawlResults/CrawlResultsNavigation';
import { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import { CrawlWorkspaceHeader } from '@/components/Domain/siteAudit/CrawlWorkspaceHeader';
import { CrawlWorkspaceNotices } from '@/components/Domain/siteAudit/CrawlWorkspaceNotices';
import { CrawlLegacyHistory } from '@/components/Domain/siteAudit/CrawlLegacyHistory';
import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { result, run } from './fixtures/crawlResultsTabsContracts';
import i18n from '@/i18n';

vi.mock('@/components/Domain/siteAudit/CrawlRunResults', () => ({ CrawlRunResults: () => null }));

type Session = ReturnType<typeof useCrawlResultsSession>;
function Harness({ component: Component }: { component: ComponentType<{ session: Session }> }) {
  const session = useCrawlResultsSession({ result, runs: [run], selectedRun: run, onSelectRun: vi.fn() });
  return <section ref={session.resultsRef}><Component session={session} /></section>;
}
const siteSession = (values: object) => ({
  crawlResult: null, crawlError: null, crawlPersistenceError: null,
  crawlPersistenceNotice: null, t: (key: string) => key,
  ...values,
}) as ReturnType<typeof useSiteAuditSession>;

describe('extracted crawler layout components', () => {
  it('keeps a saved-run picker and handles selection and crawling state', () => {
    const onSelectRun = vi.fn();
    const session = {
      result,
      runs: [run, { ...run, id: 'run-2' }],
      currentRun: run,
      isCrawling: true,
      onSelectRun,
      onDeleteRun: vi.fn(),
      deleteCurrentRun: vi.fn(),
      t: (key: string, opts?: any) => i18n.t(key, opts),
    } as any;
    render(<CrawlResultsHeader session={session} />);
    const select = screen.getByRole('combobox', { name: i18n.t('crawl.navigation.chooseSavedCrawl') });
    expect(select).toHaveProperty('value', run.id);
    expect(screen.getByText(result.start_url)).toBeTruthy();

    fireEvent.change(select, { target: { value: 'run-2' } });
    expect(onSelectRun).toHaveBeenCalledWith('run-2');
    expect(screen.getByTitle(i18n.t('crawl.navigation.deleteRunDuringCrawl'))).toBeTruthy();
  });

  it('does not throw when a saved crawl has an invalid completion timestamp', () => {
    const malformed = { ...run, completedAt: 'not-a-date' };
    render(<CrawlResultsHeader session={{ result, runs: [malformed], currentRun: malformed, isCrawling: false, onSelectRun: vi.fn(), onDeleteRun: undefined, deleteCurrentRun: vi.fn(), openMapSection: vi.fn(), t: (key: string) => key } as any} />);
    expect(screen.getByRole('option', { name: /—/ })).toBeTruthy();
  });


  it('switches the active group without hiding navigation actions', () => {
    render(<Harness component={CrawlResultsGroups} />);
    const jump = screen.getByRole('combobox', { name: i18n.t('crawl.navigation.jumpLabel') });
    fireEvent.change(jump, { target: { value: 'links' } });
    expect(jump).toHaveProperty('value', 'links');
    const startBtn = screen.getByRole('button', { name: i18n.t('crawl.navigation.scrollResultsStart') });
    const endBtn = screen.getByRole('button', { name: i18n.t('crawl.navigation.scrollResultsEnd') });
    expect(startBtn).toBeTruthy();
    expect(endBtn).toBeTruthy();
    fireEvent.click(startBtn);
    fireEvent.click(endBtn);
  });


  it('keeps the tab keyboard contract and gives translated start/end labels flexible width', () => {
    render(<Harness component={CrawlResultsTabStrip} />);
    for (const key of ['scrollTabsStart', 'scrollTabsEnd']) {
      const button = screen.getByRole('button', { name: i18n.t(`crawl.navigation.${key}`) });
      expect(button.classList.contains('w-9')).toBe(false);
      expect(button.classList.contains('min-w-9')).toBe(true);
    }
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-controls')).toBe('crawl-tab-panel');
  });

  it('uses a single opaque sticky result bar at the content origin', () => {
    const view = render(<Harness component={CrawlResultsNavigation} />);
    const sticky = view.container.querySelector('.sticky');
    expect(sticky?.classList.contains('top-0')).toBe(true);
    expect(sticky?.classList.contains('bg-slate-950')).toBe(true);
    expect(view.container.querySelectorAll('.sticky')).toHaveLength(1);
  });

  it('retains map and results actions without a second fixed dock', () => {
    const navigate = vi.fn();
    const view = render(<CrawlWorkspaceHeader session={siteSession({ crawlResult: result, setMapNavigationRequest: navigate })} />);
    expect(screen.getByRole('link', { name: 'siteAudit.resultsLink' }).getAttribute('href')).toBe('#crawl-results');
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('.fixed')).toBeNull();
    expect(view.container.querySelector('.sticky')).toBeNull();
  });

  it('preserves persisted-error retry actions and timeout notices', () => {
    const retry = vi.fn();
    render(<CrawlWorkspaceNotices session={siteSession({
      crawlError: 'crawl failed', crawlPersistenceError: 'storage full',
      crawlRuns: [run], retryCrawlPersistence: retry, isRetryingCrawlPersistence: false,
      crawlResult: { ...result, timed_out: true },
    })} />);
    expect(screen.getByText('crawl failed')).toBeTruthy();
    expect(screen.getByText('storage full')).toBeTruthy();
    expect(screen.getByText('siteAudit.timedOut')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'siteAudit.retrySave' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps persisted crawl comparison visible outside the legacy hidden dashboard', () => {
    const run = { id: 'current', completedAt: '2026-10-07T00:00:00Z', startUrl: 'https://example.test/', result: { pages: [], pages_crawled: 0 } } as any;
    const comparison = {
      added: [], removed: [], changed: [], status: 'blocked', reasons: ['different-project'],
      provenance: {
        source: 'stored-crawl-runs', scopeMatched: false,
        current: { runId: 'current', completedAt: run.completedAt, startUrl: run.startUrl, scopeFingerprint: 'a', pageCount: 0, completeness: 'complete', partial: false, partialReasons: [], provenance: 'stored-crawl-run' },
        baseline: { runId: 'baseline', completedAt: '2026-10-06T00:00:00Z', startUrl: run.startUrl, scopeFingerprint: 'b', pageCount: 0, completeness: 'complete', partial: false, partialReasons: [], provenance: 'stored-crawl-run' },
      },
    } as any;
    const view = render(<CrawlLegacyHistory session={siteSession({
      crawlResult: run.result, crawlRuns: [run, { ...run, id: 'baseline' }], historyMetrics: [], comparison,
      comparisonRunId: 'baseline', comparisonByPath: false, selectedRun: run,
      crawlEnvironmentLabel: () => 'Default', setComparisonRunId: vi.fn(), updateComparisonByPath: vi.fn(),
    })} />);
    const marker = view.getByTestId('crawl-comparison-guard');
    expect(marker.closest('[aria-hidden="true"]')).toBeNull();
  });
});
