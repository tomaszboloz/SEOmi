import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlAuthorityTab } from '@/components/Domain/crawlResults/authority/CrawlAuthorityTab';
import { CrawlResultsContent } from '@/components/Domain/crawlResults/CrawlResultsContent';

vi.mock('@/hooks/useSiteFocus', () => ({ useSiteFocus: () => ({ report: null, manualTopic: null, history: [], annotations: [], recomputeBudget: { remaining: 1, limit: 2 }, setManualTopic: vi.fn(), anchorUrls: [], setAnchorUrls: vi.fn(), recompute: vi.fn() }) }));
vi.mock('@/hooks/useTopicalAuthority', () => ({ useTopicalAuthority: () => ({ report: { taxonomy: null }, taxonomy: null, state: { running: false, progress: null, failure: null, error: null }, benchmark: null, history: [], build: vi.fn(), cancel: vi.fn(), clear: vi.fn() }) }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityHero', () => ({ AuthorityHero: () => <div>hero</div> }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityPillars', () => ({ AuthorityPillars: () => <div>pillars</div> }));
vi.mock('@/components/Domain/crawlResults/authority/CoverageMap', () => ({ CoverageMap: () => <div>coverage</div> }));
vi.mock('@/components/Domain/crawlResults/authority/SubtopicDrilldown', () => ({ SubtopicDrilldown: () => <div>drilldown</div> }));
vi.mock('@/components/Domain/crawlResults/authority/CannibalizationPanel', () => ({ CannibalizationPanel: () => <div>cannibalization</div> }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityRecommendations', () => ({ AuthorityRecommendations: () => <div>recommendations</div> }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityBenchmark', () => ({ AuthorityBenchmark: () => <div>benchmark</div> }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityHistoryChart', () => ({ AuthorityHistoryChart: () => <div>history</div> }));
vi.mock('@/components/Domain/crawlResults/aio/CrawlAioTab', () => ({ CrawlAioTab: () => <div>aio-router</div> }));
vi.mock('@/components/Domain/crawlResults/focus/CrawlFocusTab', () => ({ CrawlFocusTab: () => <div>focus-router</div> }));
vi.mock('@/components/Domain/crawlResults/trust/CrawlTrustTab', () => ({ CrawlTrustTab: () => <div>trust-router</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlOverviewTab', () => ({ CrawlOverviewTab: () => <div>overview-router</div> }));

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('coverage100 authority and crawl routers', () => {
  it('passes an absent focus language through the authority tab', () => {
    render(<CrawlAuthorityTab pages={[]} startUrl="https://example.test/" />);
    expect(screen.getByText('cannibalization')).toBeTruthy();
  });

  it('renders the previously uncovered AIO and authority tab cases', () => {
    const session = { activeTab: 'aio', result: { pages: [] }, currentRun: null, activeProjectId: null };
    const view = render(<CrawlResultsContent session={session as never} />);
    expect(screen.getByText('aio-router')).toBeTruthy();
    view.rerender(<CrawlResultsContent session={{ ...session, activeTab: 'authority' } as never} />);
    expect(screen.getByText('cannibalization')).toBeTruthy();
    view.rerender(<CrawlResultsContent session={{ ...session, activeTab: 'focus' } as never} />);
    expect(screen.getByText('focus-router')).toBeTruthy();
    view.rerender(<CrawlResultsContent session={{ ...session, activeTab: 'trust' } as never} />);
    expect(screen.getByText('trust-router')).toBeTruthy();
  });
});
