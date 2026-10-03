import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BacklinkMetricsGrid } from '@/components/Domain/backlinkChecker/BacklinkMetricsGrid';
import { BacklinkEquityAndAnchors } from '@/components/Domain/backlinkChecker/BacklinkEquityAndAnchors';
import { BacklinkInboundTable } from '@/components/Domain/backlinkChecker/BacklinkInboundTable';
import type { BacklinkProfileData } from '@/types';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string) => key) as any;

const sampleProfile: BacklinkProfileData = {
  domain: 'example.com',
  total_backlinks: 45000,
  referring_domains: 1200,
  referring_subnets: 850,
  domain_rank: 68,
  dofollow_ratio: 82,
  anchors: [
    { anchor: 'brand name', count: 500, percentage: 35 },
  ],
  total_anchor_rows: 1,
  backlinks: [
    {
      source_url: 'https://news.com/post',
      source_title: 'News Post',
      target_url: 'https://example.com',
      anchor_text: 'brand name',
      is_dofollow: true,
      domain_rank: 80,
      first_seen: '2026-01-01',
    },
  ],
  total_backlink_rows: 1,
};

describe('BacklinkChecker modular architecture', () => {
  it('satisfies physical LOC <= 150 across BacklinkChecker and submodules', () => {
    const files = [
      'src/components/Domain/BacklinkChecker.tsx',
      ...codeFiles('src/components/Domain/backlinkChecker'),
    ];
    expect(files.length).toBe(8);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders BacklinkMetricsGrid with formatted statistics', () => {
    render(
      <BacklinkMetricsGrid
        profile={sampleProfile}
        history={[]}
        t={mockT}
      />,
    );
    expect(screen.getByText('45,000')).toBeTruthy();
    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.getByText('850')).toBeTruthy();
    expect(screen.getByText('68 / 100')).toBeTruthy();
  });

  it('renders BacklinkEquityAndAnchors with ratio and anchor percentages', () => {
    render(
      <BacklinkEquityAndAnchors
        profile={sampleProfile}
        isLoading={false}
        loadMoreBacklinkAnchors={vi.fn()}
        t={mockT}
      />,
    );
    expect(screen.getByText('brand name')).toBeTruthy();
  });

  it('renders BacklinkInboundTable with backlink row details', () => {
    render(
      <BacklinkInboundTable
        profile={sampleProfile}
        isLoading={false}
        loadMoreBacklinks={vi.fn()}
        t={mockT}
      />,
    );
    expect(screen.getByText('News Post')).toBeTruthy();
    expect(screen.getByText('"brand name"')).toBeTruthy();
  });
});
