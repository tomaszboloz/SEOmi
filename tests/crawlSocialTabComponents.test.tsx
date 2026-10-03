import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawlSocialTab } from '@/components/Domain/crawlResults/CrawlSocialTab';
import { formatResourceStatus } from '@/components/Domain/crawlResults/socialTab/CrawlSocialFaviconCell';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('CrawlSocialTab modular architecture and rendering', () => {
  it('satisfies physical LOC <= 150 across socialTab files', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlSocialTab.tsx',
      ...codeFiles('src/components/Domain/crawlResults/socialTab'),
    ];
    expect(files.length).toBe(6);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders empty state when no pages have social or favicon declarations', () => {
    const session = {
      result: {
        pages: [{ url: 'https://example.com' }],
      },
      t: mockT,
    } as any;

    render(<CrawlSocialTab session={session} />);
    expect(screen.getByText('crawl.social.empty')).toBeDefined();
  });

  it('renders social table with favicon, OG, and Twitter tag values', () => {
    const session = {
      result: {
        pages: [
          {
            url: 'https://example.com/social',
            favicons: ['https://example.com/icon.png'],
            favicon_resource_checks: [
              {
                url: 'https://example.com/icon.png',
                checked_in_run: true,
                http_status: 200,
                content_length: 1024,
                intrinsic_width: 32,
                intrinsic_height: 32,
              },
            ],
            social_meta_tags: [
              { key: 'og:title', content: 'Social Title' },
              { key: 'twitter:card', content: 'summary_large_image' },
            ],
          },
        ],
      },
      t: mockT,
    } as any;

    render(<CrawlSocialTab session={session} />);
    expect(screen.getByText('https://example.com/social')).toBeDefined();
    expect(screen.getByText('https://example.com/icon.png')).toBeDefined();
    expect(screen.getByText('Social Title')).toBeDefined();
    expect(screen.getByText('summary_large_image')).toBeDefined();
  });

  it('formats resource statuses accurately', () => {
    const notChecked = formatResourceStatus({ url: 'u', checked_in_run: false }, mockT);
    expect(notChecked).toBe('crawl.social.notChecked');

    const err = formatResourceStatus({
      url: 'u',
      checked_in_run: true,
      request_error_kind: 'timeout',
    }, mockT);
    expect(err).toContain('crawl.social.requestError');
  });
});
