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
import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { result, run } from './fixtures/crawlResultsTabsContracts';
import i18n from '@/i18n';

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
  it('keeps a saved-run picker and the original crawl URL in the result header', () => {
    render(<Harness component={CrawlResultsHeader} />);
    expect(screen.getByRole('combobox', { name: i18n.t('crawl.navigation.chooseSavedCrawl') })).toHaveProperty('value', run.id);
    expect(screen.getByText(result.start_url)).toBeTruthy();
  });

  it('switches the active group without hiding navigation actions', () => {
    render(<Harness component={CrawlResultsGroups} />);
    const jump = screen.getByRole('combobox', { name: i18n.t('crawl.navigation.jumpLabel') });
    fireEvent.change(jump, { target: { value: 'links' } });
    expect(jump).toHaveProperty('value', 'links');
    expect(screen.getByRole('button', { name: i18n.t('crawl.navigation.scrollResultsStart') })).toBeTruthy();
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
});
