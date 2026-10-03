import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BacklinkChecker } from '@/components/Domain/BacklinkChecker';
import { DomainOverview } from '@/components/Domain/DomainOverview';

import { useProjectStore } from '@/stores/projectStore';

import { useToolsStore } from '@/stores/toolsStore';

describe('domain research request boundaries', () => {
beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({
      projects: [{ id: 'domain-research-project', name: 'Domain research', rootUrl: 'https://example.com', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: 'domain-research-project',
    });
    useToolsStore.setState({
      keywordQuery: 'technical seo',
      keywordCountry: 'US',
      keywordResults: [],
      isKeywordLoading: false,
      keywordError: null,
      domainQuery: 'example.com',
      domainOverview: null,
      isDomainLoading: false,
      domainError: null,
      domainComparisonTargets: [],
      domainComparison: null,
      backlinkQuery: 'example.com',
      backlinkProfile: null,
      backlinkProfileHistory: [],
      isBacklinkLoading: false,
      backlinkError: null,
      backlinkGapCompetitors: [],
      backlinkGapIncludeSubdomains: true,
      backlinkGapReport: null,
      isBacklinkGapLoading: false,
      backlinkGapError: null,
      aiBrandQuery: '',
      aiBrandDomain: '',
    });
    vi.stubGlobal('fetch', vi.fn());
  });

afterEach(() => vi.unstubAllGlobals());

it('renders factual comparison history charts and bounded profile samples', () => {
    const row = {
      domain: 'example.com',
      organic_traffic: 140,
      organic_keywords: 12,
      domain_rank: 25,
      referring_domains: 8,
      retrieved_at: '2026-09-21T12:00:00.000Z',
      top_keywords: [{ keyword: 'technical seo', position: 3, search_volume: 100, traffic_share: 12, intent: 'Informational' as const }],
      top_pages: [{ url: 'https://example.com/guide', traffic_percentage: 50, keywords_count: 4 }],
      competitors: [{ domain: 'competitor.example', common_keywords: 8, average_position: 7 }],
    };
    useToolsStore.setState({
      domainOverview: { domain: 'example.com', organic_traffic: 140, organic_keywords: 12, domain_rank: 25, referring_domains: 8, top_keywords: [], top_pages: [], competitors: [] },
      domainComparison: { target: 'example.com', rows: [row], location_code: 2840, language_code: 'en', retrieved_at: row.retrieved_at, source: 'dataforseo' },
      domainComparisonHistory: [
        { target: 'example.com', rows: [{ ...row, organic_traffic: 100, organic_keywords: null, retrieved_at: '2026-09-20T12:00:00.000Z' }], location_code: 2840, language_code: 'en', retrieved_at: '2026-09-20T12:00:00.000Z', source: 'dataforseo' },
        { target: 'example.com', rows: [row], location_code: 2840, language_code: 'en', retrieved_at: row.retrieved_at, source: 'dataforseo' },
      ],
    });

    render(<DomainOverview />);

    expect(screen.getAllByRole('img').length).toBe(1);
    expect(screen.getByText('technical seo')).toBeTruthy();
    expect(screen.getByText('https://example.com/guide')).toBeTruthy();
    expect(screen.getByText('competitor.example')).toBeTruthy();
  });

it('renders backlink summary history charts only for the active target', () => {
    useToolsStore.setState({
      backlinkProfile: {
        domain: 'example.com', total_backlinks: 140, referring_domains: 12, referring_subnets: null,
        domain_rank: 22, dofollow_ratio: 65.5, total_anchor_rows: 0, total_backlink_rows: 0, anchors: [], backlinks: [],
      },
      backlinkProfileHistory: [
        { domain: 'example.com', retrieved_at: '2026-09-20T12:00:00.000Z', total_backlinks: 100, referring_domains: 10, domain_rank: 20, dofollow_ratio: 60 },
        { domain: 'example.com', retrieved_at: '2026-09-21T12:00:00.000Z', total_backlinks: 140, referring_domains: 12, domain_rank: 22, dofollow_ratio: 65.5 },
        { domain: 'other.example', retrieved_at: '2026-09-21T12:00:00.000Z', total_backlinks: 900, referring_domains: 90, domain_rank: 90, dofollow_ratio: 90 },
      ],
    });

    render(<BacklinkChecker />);

    expect(screen.getByRole('heading', { name: /backlink profile history|historia profilu backlinków/i })).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(4);
  });
});
