import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DomainOverviewMetrics } from '@/components/Domain/domainOverview/DomainOverviewMetrics';
import { DomainCompetitors } from '@/components/Domain/domainOverview/DomainCompetitors';
import { DomainTopOrganic } from '@/components/Domain/domainOverview/DomainTopOrganic';
import type { DomainOverviewData } from '@/types';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string) => key) as any;

const sampleOverview: DomainOverviewData = {
  domain: 'example.com',
  organic_traffic: 12500,
  organic_keywords: 340,
  domain_rank: 72,
  referring_domains: 180,
  top_keywords: [
    { keyword: 'seo tool', position: 3, search_volume: 5400, traffic_share: 15, intent: 'Commercial' },
  ],
  top_pages: [
    { url: 'https://example.com/features', traffic_percentage: 25, keywords_count: 50 },
  ],
  competitors: [
    { domain: 'competitor.com', common_keywords: 120, average_position: 8.5 },
  ],
};

describe('DomainOverview modular architecture', () => {
  it('satisfies physical LOC <= 150 across DomainOverview and submodules', () => {
    const files = [
      'src/components/Domain/DomainOverview.tsx',
      ...codeFiles('src/components/Domain/domainOverview'),
    ];
    expect(files.length).toBe(9);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders DomainOverviewMetrics cards with formatted values', () => {
    render(<DomainOverviewMetrics overview={sampleOverview} t={mockT} />);
    expect(screen.getByText('12,500')).toBeTruthy();
    expect(screen.getByText('340')).toBeTruthy();
    expect(screen.getByText('72')).toBeTruthy();
    expect(screen.getByText('180')).toBeTruthy();
  });

  it('renders DomainTopOrganic tables with keyword and page rows', () => {
    render(<DomainTopOrganic overview={sampleOverview} t={mockT} />);
    expect(screen.getByText('seo tool')).toBeTruthy();
    expect(screen.getByText('#3')).toBeTruthy();
    expect(screen.getByText('https://example.com/features')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
  });

  it('renders DomainCompetitors cards', () => {
    render(<DomainCompetitors overview={sampleOverview} t={mockT} />);
    expect(screen.getByText('competitor.com')).toBeTruthy();
    expect(screen.getByText('8.5')).toBeTruthy();
  });
});
