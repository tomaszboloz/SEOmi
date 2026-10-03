import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrawlRunNotices } from '@/components/Domain/siteAudit/runResults/CrawlRunNotices';
import { CrawlSitemapComparisonCards } from '@/components/Domain/siteAudit/runResults/CrawlSitemapComparisonCards';
import { CrawlRunExportSection } from '@/components/Domain/siteAudit/runResults/CrawlRunExportSection';
import { CrawlRunResults } from '@/components/Domain/siteAudit/CrawlRunResults';
import type { SiteCrawlResult } from '@/types';

const mockT = (key: string, params?: Record<string, unknown>) => {
  if (params?.status) return `${key}:${params.status}:${params.count}`;
  if (params?.count !== undefined) return `${key}:${params.count}`;
  return key;
};

describe('CrawlRunResults submodules', () => {
  const dummyResult: SiteCrawlResult = {
    cancelled: true,
    robots_txt_status: 'found',
    robots_blocked_count: 3,
    sitemap_status: 'found',
    sitemap_urls_discovered: 12,
    rejected_urls: [{ url: 'https://example.com/bad', reason: 'Disallowed by robots.txt' }],
    pages: [],
  } as unknown as SiteCrawlResult;

  it('renders CrawlRunNotices with cancelled, robots, sitemap, and rejected URLs', () => {
    const session = {
      crawlResult: dummyResult,
      t: mockT,
    };
    render(<CrawlRunNotices session={session as any} />);
    expect(screen.getByText('siteAudit.cancelledNotice')).toBeDefined();
    expect(screen.getByText('siteAudit.robotsStatus:found:3')).toBeDefined();
    expect(screen.getByText('siteAudit.sitemapStatus:found:12')).toBeDefined();
    expect(screen.getByText('siteAudit.rejectedUrls:1')).toBeDefined();
    expect(screen.getByText(/Disallowed by robots\.txt/)).toBeDefined();
  });

  it('renders CrawlSitemapComparisonCards when sitemap URLs discovered', () => {
    const session = {
      crawlResult: dummyResult,
      sitemapOnlyUrls: ['https://example.com/sitemap-only'],
      crawlOnlyUrls: ['https://example.com/crawl-only'],
      t: mockT,
    };
    render(<CrawlSitemapComparisonCards session={session as any} />);
    expect(screen.getByText('siteAudit.sitemapOnlyTitle')).toBeDefined();
    expect(screen.getByText('siteAudit.crawlOnlyTitle')).toBeDefined();
    expect(screen.getAllByText('1').length).toBe(2);
  });

  it('renders CrawlRunExportSection with legacy warning when selectedRun is null', () => {
    const session = {
      selectedRun: null,
      crawlPdfError: null,
      t: mockT,
    };
    render(<CrawlRunExportSection session={session as any} />);
    expect(screen.getByText('siteAudit.legacyExportUnavailable')).toBeDefined();
  });

  it('returns null from CrawlRunResults when crawlResult is null', () => {
    const session = { crawlResult: null };
    const { container } = render(<CrawlRunResults session={session as any} />);
    expect(container.firstChild).toBeNull();
  });
});
