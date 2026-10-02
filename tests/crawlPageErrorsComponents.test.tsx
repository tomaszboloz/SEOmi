import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrawlPageErrorSummaryRow } from '@/components/Domain/siteAudit/pageErrors/CrawlPageErrorSummaryRow';
import { CrawlPageTechnicalMeta } from '@/components/Domain/siteAudit/pageErrors/CrawlPageTechnicalMeta';
import { CrawlPageImagesPreview } from '@/components/Domain/siteAudit/pageErrors/CrawlPageImagesPreview';
import { CrawlPageLinksPreview } from '@/components/Domain/siteAudit/pageErrors/CrawlPageLinksPreview';
import { CrawlPageErrors } from '@/components/Domain/siteAudit/CrawlPageErrors';
import { createCrawlPageFixture } from './fixtures/crawl';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts.count !== 'undefined') return `${key}:${opts.count}`;
  if (opts && typeof opts.status !== 'undefined') return `${key}:${opts.status}`;
  return key;
}) as any;

const samplePage = createCrawlPageFixture({
  url: 'https://example.com/error-page',
  title: 'Error Test Page',
  http_status: 404,
  depth: 2,
  h1_count: 1,
  response_time_ms: 250,
  issues: [
    {
      code: 'page_not_found',
      severity: 'Critical',
      message: 'Page not found (404)',
    } as any,
  ],
  images: [
    { src: 'https://example.com/logo.png', alt: 'Site Logo', lazy_loaded: true },
  ],
  links: [
    {
      target_url: 'https://example.com/home',
      anchor_text: 'Home',
      is_internal: true,
      target_http_status: 200,
    } as any,
  ],
  redirect_chain: [
    { from_url: 'https://example.com/old', to_url: 'https://example.com/error-page', http_status: 301 },
  ],
});

describe('CrawlPageErrors modular architecture', () => {
  it('satisfies physical LOC <= 150 across CrawlPageErrors and submodules', () => {
    const files = [
      'src/components/Domain/siteAudit/CrawlPageErrors.tsx',
      ...codeFiles('src/components/Domain/siteAudit/pageErrors'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders CrawlPageErrorSummaryRow with toggle behavior', () => {
    const onToggle = vi.fn();
    render(
      <table>
        <tbody>
          <CrawlPageErrorSummaryRow
            page={samplePage}
            isExpanded={false}
            onToggle={onToggle}
            t={mockT}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('Error Test Page')).toBeTruthy();
    expect(screen.getByText('404')).toBeTruthy();

    const row = screen.getByText('Error Test Page').closest('tr');
    if (row) fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledWith(samplePage.url);
  });

  it('renders CrawlPageTechnicalMeta definition list', () => {
    render(<CrawlPageTechnicalMeta page={samplePage} t={mockT} />);
    expect(screen.getByText('siteAudit.detailTitle:')).toBeTruthy();
    expect(screen.getByText(/Error Test Page/)).toBeTruthy();
  });

  it('renders CrawlPageImagesPreview and CrawlPageLinksPreview', () => {
    render(
      <div>
        <CrawlPageImagesPreview images={samplePage.images} t={mockT} />
        <CrawlPageLinksPreview links={samplePage.links} t={mockT} />
      </div>,
    );
    expect(screen.getByText(/logo\.png/)).toBeTruthy();
    expect(screen.getByText(/Home/)).toBeTruthy();
  });

  it('renders CrawlPageErrors with expanded and collapsed rows', () => {
    const toggleRow = vi.fn();
    const mockSession = {
      expandedRows: { [samplePage.url]: true },
      filteredPages: [samplePage],
      toggleRow,
      t: mockT,
    } as any;

    render(
      <table>
        <CrawlPageErrors session={mockSession} />
      </table>,
    );

    expect(screen.getAllByText(/Error Test Page/).length).toBeGreaterThan(0);
    expect(screen.getByText('siteAudit.detailTitle:')).toBeTruthy();
  });
});
