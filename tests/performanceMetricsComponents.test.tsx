import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceSummaryCards } from '@/components/Results/performanceMetrics/PerformanceSummaryCards';
import { PerformanceHttpSection } from '@/components/Results/performanceMetrics/PerformanceHttpSection';
import { PerformanceRedirectWaterfall } from '@/components/Results/performanceMetrics/PerformanceRedirectWaterfall';
import { PerformanceDiscoveryFiles } from '@/components/Results/performanceMetrics/PerformanceDiscoveryFiles';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('PerformanceMetrics modular architecture', () => {
  it('satisfies physical LOC <= 150 across performanceMetrics files', () => {
    const files = [
      'src/components/Results/PerformanceMetrics.tsx',
      ...codeFiles('src/components/Results/performanceMetrics'),
    ];
    expect(files.length).toBe(5);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders PerformanceSummaryCards with latency and hops', () => {
    const audit = {
      response_time_ms: 320,
      redirect_chain: [],
      technical: { server: 'nginx', content_type: 'text/html' },
    };

    render(<PerformanceSummaryCards audit={audit as any} t={mockT} />);
    expect(screen.getByText('320')).toBeTruthy();
    expect(screen.getByText('nginx')).toBeTruthy();
    expect(screen.getByText('performance.directConnection')).toBeTruthy();
  });

  it('renders PerformanceHttpSection with detailed timings and sizes', () => {
    const httpPerformance = {
      measured_at: '2026-10-01T12:00:00.000Z',
      response_headers_ms: 45,
      body_read_ms: 120,
      total_request_ms: 165,
      decoded_body_bytes: 45000,
      content_length_header_bytes: 45000,
      redirect_hops: 0,
      method: 'GET',
    };

    render(<PerformanceHttpSection httpPerformance={httpPerformance as any} t={mockT} />);
    expect(screen.getByText('performance.httpMeasurement')).toBeTruthy();
    expect(screen.getByText(/45 performance\.milliseconds/)).toBeTruthy();
    expect(screen.getByText('GET')).toBeTruthy();
  });

  it('renders PerformanceRedirectWaterfall with hops and final url', () => {
    const redirectChain = [
      { url: 'http://example.com', status_code: 301, location: 'https://example.com' },
    ];

    render(
      <PerformanceRedirectWaterfall
        redirectChain={redirectChain as any}
        finalUrl="https://example.com/"
        httpStatus={200}
        t={mockT}
      />,
    );
    expect(screen.getByText('http://example.com')).toBeTruthy();
    expect(screen.getByText('https://example.com/')).toBeTruthy();
  });

  it('renders PerformanceDiscoveryFiles with robots and sitemap links', () => {
    const technical = {
      robots_txt_url: 'https://example.com/robots.txt',
      sitemap_url: 'https://example.com/sitemap.xml',
    };

    render(<PerformanceDiscoveryFiles technical={technical as any} t={mockT} />);
    expect(screen.getByText('https://example.com/robots.txt')).toBeTruthy();
    expect(screen.getByText('https://example.com/sitemap.xml')).toBeTruthy();
  });
});
