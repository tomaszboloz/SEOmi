import { describe, expect, it } from 'vitest';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import { excludeQuarantinedPages, runRecommendationBus } from '@/services/recommendationBus';
import { createCrawlPageFixture as page } from './fixtures/crawl';

describe('recommendation consistency', () => {
  it('does not keep an opportunity when its requested URL is quarantined but final_url differs', () => {
    const pages = [
      page({ url: 'https://site.test/removed', final_url: 'https://site.test/current', semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
      page({ url: 'https://site.test/source', final_url: 'https://site.test/source', semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
    ];
    const { quarantine } = runRecommendationBus({ removeUrls: ['https://site.test/removed'] });
    expect(findInternalLinkOpportunities(pages).opportunities).toHaveLength(2);
    const safePages = excludeQuarantinedPages(pages, quarantine);
    const report = findInternalLinkOpportunities(safePages);

    expect(safePages.map((entry) => entry.url)).toEqual(['https://site.test/source']);
    expect(report.opportunities).toEqual([]);
  });

  it('does not use a non-indexable page as either recommendation endpoint', () => {
    const pages = [
      page({ url: 'https://site.test/indexable', final_url: 'https://site.test/indexable', semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
      page({ url: 'https://site.test/noindex', final_url: 'https://site.test/noindex', indexability_status: 'Excluded by robots directive', semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
    ];

    const report = findInternalLinkOpportunities(pages);

    expect(report.eligiblePageCount).toBe(1);
    expect(report.opportunities).toEqual([]);
  });
});
