import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawlSummaryMetrics } from '@/components/Domain/crawlResults/CrawlSummaryMetrics';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('CrawlSummaryMetrics modular architecture and rendering', () => {
  it('satisfies physical LOC <= 150 across summaryMetrics files', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlSummaryMetrics.tsx',
      ...codeFiles('src/components/Domain/crawlResults/summaryMetrics'),
    ];
    expect(files.length).toBe(4);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders summary metrics table rows for a complete crawl result', () => {
    const session = {
      result: {
        start_url: 'https://example.com',
        health_score: 88,
        pages_crawled: 42,
        discovery_provenance_truncated: true,
        limit_reasons: ['max_pages'],
        critical_count: 1,
        warning_count: 2,
        notice_count: 3,
        duration_ms: 1540,
        robots_txt_status: 'found',
        robots_blocked_count: 0,
        robots_user_agent: 'SEOmiBot',
        robots_applicable_rules: [{ directive: 'disallow', path: '/admin' }],
        robots_agent_matrix: [{
          user_agent: 'Googlebot',
          applicable_rules: [{ directive: 'disallow', path: '/private' }],
          specific_group: true,
          crawl_delay_ms: 500,
        }],
        robots_sitemap_directives: ['https://example.com/sitemap.xml'],
        sitemap_status: 'found',
        sitemap_urls_discovered: 10,
        pages: [
          { internal_link_count: 5, external_link_count: 2 },
          { internal_link_count: 3, external_link_count: 1 },
        ],
        cancelled: false,
        timed_out: false,
      },
      sitemapOnlyCount: 2,
      crawlOnlyCount: 1,
      t: mockT,
    } as any;

    render(
      <table>
        <tbody>
          <CrawlSummaryMetrics session={session} />
        </tbody>
      </table>,
    );

    expect(screen.getByText('https://example.com')).toBeDefined();
    expect(screen.getByText('88 / 100')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('crawl.ui.provenanceTruncated')).toBeDefined();
    expect(screen.getByText('Googlebot')).toBeDefined();
    expect(screen.getByText('DISALLOW: /admin')).toBeDefined();
  });

  it('renders cancelled and timed out indicators when present', () => {
    const session = {
      result: {
        start_url: 'https://example.com/cancelled',
        health_score: 0,
        pages_crawled: 5,
        critical_count: 0,
        warning_count: 0,
        notice_count: 0,
        duration_ms: 3000,
        pages: [],
        cancelled: true,
        timed_out: true,
      },
      sitemapOnlyCount: 0,
      crawlOnlyCount: 0,
      t: mockT,
    } as any;

    render(
      <table>
        <tbody>
          <CrawlSummaryMetrics session={session} />
        </tbody>
      </table>,
    );

    expect(screen.getByText('crawl.ui.cancelledValue')).toBeDefined();
    expect(screen.getByText('crawl.ui.timedOutValue')).toBeDefined();
  });
});
