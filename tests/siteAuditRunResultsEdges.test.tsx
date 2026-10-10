import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawlRunNotices } from '@/components/Domain/siteAudit/runResults/CrawlRunNotices';
import { CrawlSitemapComparisonCards } from '@/components/Domain/siteAudit/runResults/CrawlSitemapComparisonCards';

describe('CrawlRunNotices coverage edges', () => {
  const t = ((k: string, opts?: { status?: string; count?: number }) =>
    opts ? `${k}:${opts.status || ''}:${opts.count ?? ''}` : k) as any;

  it('returns null when crawlResult is null', () => {
    const session = { crawlResult: null, t } as any;
    const { container } = render(<CrawlRunNotices session={session} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders standard notices without cancellation or rejected URLs', () => {
    const session = {
      crawlResult: {
        cancelled: false,
        robots_txt_status: 'Allowed',
        robots_blocked_count: 0,
        sitemap_status: 'Found',
        sitemap_urls_discovered: 10,
        rejected_urls: undefined,
      },
      t,
    } as any;
    const { container } = render(<CrawlRunNotices session={session} />);
    expect(screen.queryByText('siteAudit.cancelledNotice')).toBeNull();
    expect(container.querySelector('details')).toBeNull();
    expect(screen.getByText('siteAudit.robotsStatus:Allowed:0')).toBeTruthy();
  });

  it('renders cancellation banner and rejected URL list', () => {
    const session = {
      crawlResult: {
        cancelled: true,
        robots_txt_status: 'Blocked',
        robots_blocked_count: 3,
        sitemap_status: 'Missing',
        sitemap_urls_discovered: 0,
        rejected_urls: [
          { url: 'https://example.com/blocked', reason: 'RobotsTxt' },
          { url: 'https://example.com/invalid', reason: 'Malformed' },
        ],
      },
      t,
    } as any;
    const { container } = render(<CrawlRunNotices session={session} />);
    expect(screen.getByText('siteAudit.cancelledNotice')).toBeTruthy();
    expect(container.querySelector('details')).not.toBeNull();
    expect(screen.getByText(/https:\/\/example\.com\/blocked/)).toBeTruthy();
  });
});

describe('CrawlSitemapComparisonCards coverage edges', () => {
  const t = ((k: string) => k) as any;

  it('returns null when crawlResult is missing', () => {
    const session = { crawlResult: null, sitemapOnlyUrls: [], crawlOnlyUrls: [], t } as any;
    const { container } = render(<CrawlSitemapComparisonCards session={session} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when sitemap_urls_discovered is zero or negative', () => {
    const sessionZero = {
      crawlResult: { sitemap_urls_discovered: 0 },
      sitemapOnlyUrls: [],
      crawlOnlyUrls: [],
      t,
    } as any;
    const { container: containerZero } = render(<CrawlSitemapComparisonCards session={sessionZero} />);
    expect(containerZero.firstChild).toBeNull();

    const sessionNegative = {
      crawlResult: { sitemap_urls_discovered: -3 },
      sitemapOnlyUrls: [],
      crawlOnlyUrls: [],
      t,
    } as any;
    const { container: containerNegative } = render(<CrawlSitemapComparisonCards session={sessionNegative} />);
    expect(containerNegative.firstChild).toBeNull();
  });

  it('renders cards with counts when sitemaps are discovered', () => {
    const session = {
      crawlResult: { sitemap_urls_discovered: 5 },
      sitemapOnlyUrls: ['https://example.com/s1', 'https://example.com/s2'],
      crawlOnlyUrls: ['https://example.com/c1'],
      t,
    } as any;
    render(<CrawlSitemapComparisonCards session={session} />);
    expect(screen.getByText('siteAudit.sitemapOnlyTitle')).toBeTruthy();
    expect(screen.getByText('siteAudit.crawlOnlyTitle')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });
});
