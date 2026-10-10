import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { SummaryRobotsMetricsRows } from '@/components/Domain/crawlResults/summaryMetrics/SummaryRobotsMetricsRows';
import { createCrawlResultFixture } from './fixtures/crawl';

const t = ((key: string) => key) as TFunction;
const rules = Array.from({ length: 13 }, (_, index) => ({ directive: 'allow', path: `/page-${index}` }));

describe('robots summary edge contracts', () => {
  it('renders agent fallback markers, absent delays and bounded rule overflow', () => {
    const result = createCrawlResultFixture({
      robots_user_agent: 'SEOmiBot', robots_applicable_rules: [{ directive: 'allow', path: '/' }],
      robots_agent_matrix: [
        { user_agent: 'GenericBot', specific_group: false, applicable_rules: [], crawl_delay_ms: null },
        { user_agent: 'SpecificBot', specific_group: true, applicable_rules: rules, crawl_delay_ms: 250 },
        { user_agent: 'ShortBot', specific_group: false, applicable_rules: [{ directive: 'allow', path: '/short' }], crawl_delay_ms: null },
      ], robots_sitemap_directives: ['https://site.test/sitemap.xml'],
    });
    render(<table><tbody><SummaryRobotsMetricsRows result={result} t={t} /></tbody></table>);
    expect(screen.getAllByText('*').length).toBeGreaterThan(0);
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('250 performance.milliseconds')).toBeTruthy();
    expect(screen.getByText('ALLOW: /page-11')).toBeTruthy();
  });

  it('renders legacy fallbacks when robots metadata is absent', () => {
    render(<table><tbody><SummaryRobotsMetricsRows result={createCrawlResultFixture()} t={t} /></tbody></table>);
    expect(screen.getByText('crawl.ui.noDataOlderRun')).toBeTruthy();
    expect(screen.getByText('crawl.ui.noRulesOlderRun')).toBeTruthy();
    expect(screen.getByText('crawl.ui.noDeclarationsOlderRun')).toBeTruthy();
  });
});
