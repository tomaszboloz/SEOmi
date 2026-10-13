import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { BacklinkChecker } from '@/components/Domain/BacklinkChecker';
import { CrawlResultsHeader } from '@/components/Domain/crawlResults/CrawlResultsHeader';
import { CrawlPaginationSection } from '@/components/Domain/crawlResults/internationalTab/CrawlPaginationSection';
import { CrawlPageDiscoveryCell } from '@/components/Domain/crawlResults/pageTable/CrawlPageDiscoveryCell';
import { PerformanceDistributionChart } from '@/components/Domain/crawlResults/performanceTab/PerformanceDistributionChart';
import { CrawlSocialMetaTagsCell } from '@/components/Domain/crawlResults/socialTab/CrawlSocialMetaTagsCell';
import { DomainComparisonTable } from '@/components/Domain/domainOverview/DomainComparisonTable';
import { CrawlResourceRows } from '@/components/Domain/siteAudit/CrawlResourceRows';
import { CrawlPageTechnicalMeta } from '@/components/Domain/siteAudit/pageErrors/CrawlPageTechnicalMeta';
import { useToolsStore } from '@/stores/toolsStore';
import type { CrawledPageSummary, DomainComparisonData } from '@/types';
import { createCrawlPageFixture, createCrawlRunFixture } from './fixtures/crawl';

const t = i18n.t.bind(i18n) as never;

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => cleanup());

describe('crawl results header without a selected run', () => {
  it('falls back to the first saved run as the selected option', () => {
    const run = createCrawlRunFixture({ id: 'saved-run' });
    const session = {
      currentRun: null, deleteCurrentRun: vi.fn(), isCrawling: false, onDeleteRun: vi.fn(), onSelectRun: vi.fn(), openMapSection: vi.fn(),
      result: { ...run.result, pages: [] }, runs: [run], t: i18n.t.bind(i18n),
    };
    render(<CrawlResultsHeader session={session as never} />);
    const select = screen.getByLabelText(i18n.t('crawl.navigation.chooseSavedCrawl')) as HTMLSelectElement;
    expect(select.value).toBe('saved-run');
  });
});

describe('pagination section for pages without declarations', () => {
  it('renders an invalid-pagination row for a page lacking pagination_links', () => {
    const page = createCrawlPageFixture({ url: 'https://site.test/p', pagination_links: undefined });
    render(<CrawlPaginationSection pages={[page]} t={t} />);
    expect(screen.getByText('https://site.test/p')).toBeTruthy();
  });
});

describe('page discovery cell overflow', () => {
  it('summarizes sources beyond the first two', () => {
    const page = createCrawlPageFixture({
      discovery_sources: [1, 2, 3, 4].map((index) => ({ kind: 'link', source_url: `https://site.test/s${index}`, anchor_text: `a${index}` })),
    } as Partial<CrawledPageSummary>);
    render(<table><tbody><tr><CrawlPageDiscoveryCell page={page} t={t} /></tr></tbody></table>);
    expect(screen.getByText(i18n.t('crawl.ui.moreSources', { count: 2 }))).toBeTruthy();
  });
});

describe('performance distribution chart with no timings', () => {
  it('renders empty bars when there are no measured timings', () => {
    const { container } = render(<PerformanceDistributionChart buckets={[{ label: '<100ms', count: 0 }]} timingsCount={0} t={t} />);
    expect((container.querySelector('div.bg-emerald-400') as HTMLElement).style.width).toBe('0%');
  });
});

describe('social meta tag cell content states', () => {
  it('distinguishes missing and empty tag content', () => {
    const page = createCrawlPageFixture({
      social_meta_tags: [{ key: 'og:title', content: undefined }, { key: 'og:description', content: '' }, { key: 'og:type', content: 'article' }],
    } as unknown as Partial<CrawledPageSummary>);
    render(<table><tbody><tr><CrawlSocialMetaTagsCell page={page} prefix="og:" t={t} /></tr></tbody></table>);
    expect(screen.getByText(i18n.t('crawl.social.missingContent'))).toBeTruthy();
    expect(screen.getByText(i18n.t('crawl.social.emptyContent'))).toBeTruthy();
    expect(screen.getByText('article')).toBeTruthy();
  });
});

describe('domain comparison row without competitors', () => {
  it('does not render a competitor block when the row has no competitors', () => {
    const empty = { organic_traffic: null, organic_keywords: null, domain_rank: null, referring_domains: null, total_backlinks: null, dofollow_ratio: null };
    const comparison = { target: 'me.test', rows: [{ ...empty, domain: 'me.test', top_keywords: [{ keyword: 'alpha', position: 1 }] }] } as unknown as DomainComparisonData;
    render(<DomainComparisonTable comparison={comparison} t={t} />);
    expect(screen.queryByText(i18n.t('domainResearchUi.competitors'))).toBeNull();
  });
});

describe('crawl resource rows', () => {
  it('names the intrinsic dimension source when the crawler did not record one', () => {
    const resource = { url: 'https://site.test/a.png', resource_type: 'image', http_status: 200, source_urls: ['https://site.test/'], intrinsic_width: 10, intrinsic_height: 20 };
    render(<table><CrawlResourceRows session={{ filteredResources: [resource], t: i18n.t.bind(i18n) } as never} /></table>);
    expect(screen.getByText(`10 × 20 · ${i18n.t('crawlDeepUi.intrinsic')}`)).toBeTruthy();
  });
});

describe('page technical meta without a simhash', () => {
  it('shows the content hash without a simhash suffix', () => {
    const page = createCrawlPageFixture({ content_hash: 'abcdef1234567890', content_simhash: '', word_count: 12 });
    render(<CrawlPageTechnicalMeta page={page} t={t} />);
    const hashText = screen.getByText(new RegExp(`${i18n.t('siteAudit.contentHash')} abcdef123456`));
    expect(hashText.textContent).not.toContain(i18n.t('siteAudit.simHash'));
  });
});

describe('backlink checker error banner', () => {
  it('shows the backlink error from the tools store', () => {
    useToolsStore.setState({ backlinkError: 'Backlink service unavailable' });
    render(<BacklinkChecker />);
    expect(screen.getByText('Backlink service unavailable')).toBeTruthy();
    act(() => { useToolsStore.setState({ backlinkError: null }); });
  });
});
