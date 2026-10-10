import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DomainOverviewMetrics } from '@/components/Domain/domainOverview/DomainOverviewMetrics';
import { DomainTopOrganic } from '@/components/Domain/domainOverview/DomainTopOrganic';
import type { DomainOverviewData } from '@/types';
import type { TFunction } from 'i18next';

const t = ((key: string) => key) as TFunction;
const emptyOverview: DomainOverviewData = {
  domain: 'site.test', organic_traffic: null, organic_keywords: null, domain_rank: null, referring_domains: null,
  top_keywords: [{ keyword: 'missing metrics', position: null, search_volume: null, traffic_share: null, intent: null }],
  top_pages: [{ url: 'https://site.test/landing', traffic_percentage: null, keywords_count: null }], competitors: [],
};

describe('domain overview missing metric contracts', () => {
  it('renders explicit dashes for every unavailable metric card', () => {
    const { rerender } = render(<DomainOverviewMetrics overview={emptyOverview} t={t} />);
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('/ 100')).toBeNull();
    rerender(<DomainOverviewMetrics overview={{ ...emptyOverview, domain_rank: 42 }} t={t} />);
    expect(screen.getByText('/ 100')).toBeTruthy();
  });

  it('renders explicit dashes for unavailable keyword and landing-page metrics', () => {
    const { rerender } = render(<DomainTopOrganic overview={emptyOverview} t={t} />);
    const tables = screen.getAllByRole('table');
    expect(within(tables[0]).getAllByText('—')).toHaveLength(3);
    expect(within(tables[1]).getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('missing metrics')).toBeTruthy();
    expect(screen.getByText('https://site.test/landing')).toBeTruthy();
    rerender(<DomainTopOrganic overview={{
      ...emptyOverview,
      top_keywords: [{ keyword: 'ranked', position: 3, search_volume: 100, traffic_share: 12, intent: null }],
      top_pages: [{ url: 'https://site.test/ranked', traffic_percentage: 7, keywords_count: 9 }],
    }} t={t} />);
    expect(screen.getByText('#3')).toBeTruthy();
    expect(screen.getByText('12%')).toBeTruthy();
    expect(screen.getByText('7%')).toBeTruthy();
  });
});
