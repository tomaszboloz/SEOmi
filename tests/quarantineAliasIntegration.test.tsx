import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InternalLinkOpportunitiesPanel } from '@/components/Charts/InternalLinkOpportunitiesPanel';
import { runRecommendationBus } from '@/services/recommendationBus';
import { createCrawlPageFixture as page } from './fixtures/crawl';
import '@/i18n';

const eligible = (url: string, final_url = url) => page({
  url, final_url, title: url, semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [],
});

describe('quarantine aliases in the standalone links panel', () => {
  it('filters quarantined donor and target requested URL aliases before generation', () => {
    const pages = [
      eligible('https://s.test/removed-donor', 'https://s.test/final-donor'),
      eligible('https://s.test/removed-target', 'https://s.test/final-target'),
      eligible('https://s.test/clean-one'),
      eligible('https://s.test/clean-two'),
    ];
    const { quarantine } = runRecommendationBus({
      removeUrls: ['https://s.test/removed-donor', 'https://s.test/removed-target'],
    });

    render(<InternalLinkOpportunitiesPanel pages={pages} quarantine={quarantine} />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('https://s.test/clean-one');
    expect(hrefs).toContain('https://s.test/clean-two');
    expect(hrefs).not.toContain('https://s.test/final-donor');
    expect(hrefs).not.toContain('https://s.test/final-target');
  });
});
