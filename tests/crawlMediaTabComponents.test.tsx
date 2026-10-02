import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { flattenPageImages } from '@/components/Domain/crawlResults/mediaTab/mediaTabTypes';
import { CrawlMediaImagesSection } from '@/components/Domain/crawlResults/mediaTab/CrawlMediaImagesSection';
import { CrawlMediaResourceFilter } from '@/components/Domain/crawlResults/mediaTab/CrawlMediaResourceFilter';
import { CrawlMediaResourcesSection } from '@/components/Domain/crawlResults/mediaTab/CrawlMediaResourcesSection';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts.count !== 'undefined') return `${key}:${opts.count}`;
  if (opts && typeof opts.visible !== 'undefined') return `${key}:${opts.visible}/${opts.total}`;
  return key;
}) as any;

describe('CrawlMediaTab modular architecture', () => {
  it('satisfies physical LOC <= 150 across CrawlMediaTab and submodules', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlMediaTab.tsx',
      ...codeFiles('src/components/Domain/crawlResults/mediaTab'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('flattenPageImages transforms pages into flat list with keys', () => {
    const mockPages: any[] = [
      {
        url: 'https://seomi.org',
        images: [
          { src: 'https://seomi.org/logo.png', alt: 'Logo' },
          { src: 'https://seomi.org/hero.jpg', alt: 'Hero' },
        ],
      },
      {
        url: 'https://seomi.org/about',
        images: [{ src: 'https://seomi.org/team.jpg', alt: 'Team' }],
      },
    ];
    const flattened = flattenPageImages(mockPages);
    expect(flattened.length).toBe(3);
    expect(flattened[0].key).toContain('logo.png');
    expect(flattened[2].page.url).toBe('https://seomi.org/about');
  });

  it('renders CrawlMediaImagesSection with empty and populated states', () => {
    const { rerender } = render(<CrawlMediaImagesSection pages={[]} t={mockT} />);
    expect(screen.getByText('crawl.ui.noImages')).toBeTruthy();

    const mockPages: any[] = [
      {
        url: 'https://seomi.org/blog',
        images: [
          {
            src: 'https://seomi.org/cover.webp',
            alt: 'Cover photo',
            http_status: 200,
            checked_in_run: true,
            content_length: 45000,
            format: 'webp',
            width: 800,
            height: 600,
            lazy_loaded: true,
          },
        ],
      },
    ];
    rerender(<CrawlMediaImagesSection pages={mockPages} t={mockT} />);
    expect(screen.getByText('https://seomi.org/cover.webp')).toBeTruthy();
    expect(screen.getByText('Cover photo')).toBeTruthy();
  });

  it('renders CrawlMediaResourceFilter and triggers filter updates', () => {
    const onFilterChange = vi.fn();
    render(
      <CrawlMediaResourceFilter
        visibleCount={10}
        totalCount={25}
        resourceLimitReached={true}
        filter="all"
        onFilterChange={onFilterChange}
        t={mockT}
      />,
    );
    expect(screen.getByText('siteAudit.resourceLimitReached')).toBeTruthy();
    const orphanedBtn = screen.getByRole('button', { name: /crawl.ui.orphaned/i });
    fireEvent.click(orphanedBtn);
    expect(onFilterChange).toHaveBeenCalledWith('orphaned');
  });

  it('renders CrawlMediaResourcesSection with resource rows', () => {
    const mockRow: any = {
      resource: {
        url: 'https://seomi.org/styles.css',
        resource_type: 'stylesheet',
        http_status: 200,
        content_type: 'text/css',
        content_length: 12000,
        response_time_ms: 45,
      },
      status: 'known',
      sourceUrls: ['https://seomi.org'],
      knownSourceUrls: ['https://seomi.org'],
    };
    render(
      <CrawlMediaResourcesSection
        resourceInventory={[mockRow]}
        visibleResourceInventory={[mockRow]}
        resourceLimitReached={false}
        filter="all"
        onFilterChange={vi.fn()}
        t={mockT}
      />,
    );
    expect(screen.getByText('https://seomi.org/styles.css')).toBeTruthy();
    expect(screen.getByText('stylesheet')).toBeTruthy();
  });
});
