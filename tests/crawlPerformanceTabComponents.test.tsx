import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { calculateTimingMetrics } from '@/components/Domain/crawlResults/performanceTab/performanceHelpers';
import { PerformanceSummaryCards } from '@/components/Domain/crawlResults/performanceTab/PerformanceSummaryCards';
import { PerformanceDistributionChart } from '@/components/Domain/crawlResults/performanceTab/PerformanceDistributionChart';
import { PerformancePagesTable } from '@/components/Domain/crawlResults/performanceTab/PerformancePagesTable';
import { CrawlPerformanceTab } from '@/components/Domain/crawlResults/CrawlPerformanceTab';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts.value !== 'undefined') return `${key}:${opts.value}`;
  return key;
}) as any;

describe('CrawlPerformanceTab modular architecture', () => {
  it('satisfies physical LOC <= 150 across CrawlPerformanceTab and submodules', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlPerformanceTab.tsx',
      ...codeFiles('src/components/Domain/crawlResults/performanceTab'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('calculates timing metrics, buckets, and median correctly', () => {
    const p1 = createCrawlPageFixture({ response_time_ms: 50 });
    const p2 = createCrawlPageFixture({ response_time_ms: 150 });
    const p3 = createCrawlPageFixture({ response_time_ms: 400 });
    const p4 = createCrawlPageFixture({ response_time_ms: 1200, rendered_lcp_ms: 800 });

    const metrics = calculateTimingMetrics([p1, p2, p3, p4], mockT);
    expect(metrics.timings).toEqual([50, 150, 400, 1200]);
    expect(metrics.median).toBe(275);
    expect(metrics.buckets[0].count).toBe(1);
    expect(metrics.buckets[1].count).toBe(1);
    expect(metrics.buckets[2].count).toBe(1);
    expect(metrics.buckets[3].count).toBe(1);
    expect(metrics.renderedVitalsPages.length).toBe(1);
  });

  it('renders PerformanceSummaryCards correctly', () => {
    render(
      <PerformanceSummaryCards
        timings={[50, 150, 400]}
        median={150}
        crawlMode="http"
        t={mockT}
      />,
    );
    expect(screen.getByText('50 ms')).toBeTruthy();
    expect(screen.getByText('150 ms')).toBeTruthy();
    expect(screen.getByText('400 ms')).toBeTruthy();
  });

  it('renders PerformanceDistributionChart correctly', () => {
    const buckets = [
      { label: '<100ms', count: 5 },
      { label: '100-299ms', count: 3 },
    ];
    render(
      <PerformanceDistributionChart
        buckets={buckets}
        timingsCount={8}
        crawlMode="http"
        t={mockT}
      />,
    );
    expect(screen.getByText('<100ms')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders PerformancePagesTable correctly', () => {
    const pages = [
      createCrawlPageFixture({
        url: 'https://example.com/fast',
        http_status: 200,
        response_time_ms: 80,
      }),
    ];
    render(<PerformancePagesTable pages={pages} crawlMode="http" t={mockT} />);
    expect(screen.getByText('https://example.com/fast')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
  });

  it('renders CrawlPerformanceTab facade', () => {
    const mockSession = {
      createRenderedArtifact: vi.fn(),
      renderedArtifact: null,
      renderedArtifactError: null,
      renderedArtifactKind: null,
      renderedArtifactUrl: 'https://example.com',
      renderedArtifactUrls: ['https://example.com'],
      result: createCrawlResultFixture({
        crawl_mode: 'http',
        pages: [
          createCrawlPageFixture({
            url: 'https://example.com/page1',
            response_time_ms: 100,
          }),
        ],
      }),
      setRenderedArtifactUrl: vi.fn(),
      t: mockT,
    } as any;

    render(<CrawlPerformanceTab session={mockSession} />);
    expect(screen.getByText('https://example.com/page1')).toBeTruthy();
    expect(screen.getAllByText('100 ms').length).toBe(3);
  });
});
