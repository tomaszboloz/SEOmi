import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawlResultsContent } from '@/components/Domain/crawlResults/CrawlResultsContent';
import { CrawlLanguageHreflangSection } from '@/components/Domain/crawlResults/internationalTab/CrawlLanguageHreflangSection';
import { DomainComparisonHistory } from '@/components/Domain/domainOverview/DomainComparisonHistory';
import type { CrawledPageSummary } from '@/types';

vi.mock('@/components/Domain/crawlResults/CrawlOverviewTab', () => ({ CrawlOverviewTab: () => <div>overview-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlCrawlerReadinessTab', () => ({ CrawlCrawlerReadinessTab: () => <div>readiness-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlUrlsTab', () => ({ CrawlUrlsTab: () => <div>urls-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlIssuesTab', () => ({ CrawlIssuesTab: () => <div>issues-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlContentTab', () => ({ CrawlContentTab: () => <div>content-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlMetadataTab', () => ({ CrawlMetadataTab: () => <div>metadata-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlCustomSearchTab', () => ({ CrawlCustomSearchTab: () => <div>search-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlLinksTab', () => ({ CrawlLinksTab: () => <div>links-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlMediaTab', () => ({ CrawlMediaTab: () => <div>media-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlFramesTab', () => ({ CrawlFramesTab: () => <div>frames-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlSocialTab', () => ({ CrawlSocialTab: () => <div>social-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlDirectivesTab', () => ({ CrawlDirectivesTab: () => <div>directives-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlInternationalTab', () => ({ CrawlInternationalTab: () => <div>international-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlStructuredTab', () => ({ CrawlStructuredTab: () => <div>structured-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlValidationTab', () => ({ CrawlValidationTab: () => <div>validation-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlPerformanceTab', () => ({ CrawlPerformanceTab: () => <div>perf-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlVisualisationsTab', () => ({ CrawlVisualisationsTab: () => <div>visual-tab</div> }));
vi.mock('@/components/Domain/crawlResults/CrawlExportsTab', () => ({ CrawlExportsTab: () => <div>exports-tab</div> }));

describe('CrawlResultsContent tab router coverage', () => {
  const tabs = [
    'overview', 'crawlerReadiness', 'urls', 'issues', 'content', 'metadata',
    'customSearch', 'links', 'media', 'frames', 'social', 'directives',
    'international', 'structured', 'validation', 'performance', 'visualisations', 'exports',
  ];

  it.each(tabs)('renders %s tab', (tab) => {
    const session = { activeTab: tab } as any;
    const { container } = render(<CrawlResultsContent session={session} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('returns null on unknown activeTab', () => {
    const session = { activeTab: 'unknown_tab' } as any;
    const { container } = render(<CrawlResultsContent session={session} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('CrawlLanguageHreflangSection empty and populated cases', () => {
  it('returns null when pages is empty', () => {
    const { container } = render(<CrawlLanguageHreflangSection pages={[]} t={((k: string) => k) as any} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders table when pages are provided', () => {
    const page = { url: 'https://example.com/en', hreflangs: [] } as unknown as CrawledPageSummary;
    render(<CrawlLanguageHreflangSection pages={[page]} t={((k: string) => k) as any} />);
    expect(screen.getByText('crawlDeepUi.languageHreflangAmp')).toBeTruthy();
  });
});

describe('DomainComparisonHistory empty and fallback trend cases', () => {
  const t = ((k: string) => k) as any;

  it('returns null when history is empty', () => {
    const { container } = render(<DomainComparisonHistory comparison={{ rows: [] } as any} history={[]} t={t} />);
    expect(container.firstChild).toBeNull();
  });

  it('handles snapshots with missing row domains and derives trends', () => {
    const comparison = { rows: [{ domain: 'example.com' }] } as any;
    const history = [
      { retrieved_at: '2026-01-01T00:00:00Z', rows: [{ domain: 'example.com', organic_traffic: 120, organic_keywords: 40 }] },
      { retrieved_at: '2026-01-02T00:00:00Z', rows: [] },
    ] as any;
    render(<DomainComparisonHistory comparison={comparison} history={history} t={t} />);
    expect(screen.getByText('domainResearchUi.historyTitle')).toBeTruthy();
    expect(screen.getByText('example.com')).toBeTruthy();
  });
});
