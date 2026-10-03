import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrawlPageTableHeader } from '@/components/Domain/crawlResults/pageTable/CrawlPageTableHeader';
import { CrawlPageDiscoveryCell } from '@/components/Domain/crawlResults/pageTable/CrawlPageDiscoveryCell';
import { CrawlPageEvidenceIssues } from '@/components/Domain/crawlResults/pageTable/CrawlPageEvidenceIssues';
import { CrawlPageTableRow } from '@/components/Domain/crawlResults/pageTable/CrawlPageTableRow';
import { CrawlPageTable } from '@/components/Domain/crawlResults/CrawlPageTable';
import { createCrawlPageFixture } from './fixtures/crawl';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string) => key) as any;

const samplePage = createCrawlPageFixture({
  url: 'https://example.com/test',
  http_status: 200,
  title: 'Test Page',
  depth: 1,
  word_count: 500,
  response_time_ms: 120,
  issues: [
    {
      code: 'missing_meta_description',
      severity: 'warning',
      message: 'Missing meta description',
    } as any,
  ],
  redirect_chain: [
    { from_url: 'https://example.com/redirect', to_url: 'https://example.com/test', http_status: 301 },
  ],
  discovery_sources: [
    {
      kind: 'sitemap',
      source_url: 'https://example.com/sitemap.xml',
    },
  ],
});

describe('CrawlPageTable and pageTable components', () => {
  it('satisfies physical LOC <= 150 across CrawlPageTable and pageTable', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlPageTable.tsx',
      ...codeFiles('src/components/Domain/crawlResults/pageTable'),
    ];
    expect(files.length).toBe(6);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders CrawlPageTableHeader with sort interaction', () => {
    const setSort = vi.fn();
    const setDescending = vi.fn();

    render(
      <table>
        <CrawlPageTableHeader
          sort="status"
          descending={false}
          setSort={setSort}
          setDescending={setDescending}
          crawlMode="http"
          t={mockT}
        />
      </table>,
    );

    const statusHeaderBtn = screen.getByRole('button', { name: /crawl\.ui\.status/i });
    expect(statusHeaderBtn).toBeTruthy();
    const urlHeaderBtn = screen.getByRole('button', { name: /crawl\.ui\.url/i });
    fireEvent.click(urlHeaderBtn);
    expect(setSort).toHaveBeenCalledWith('url');
  });

  it('renders CrawlPageDiscoveryCell with tags', () => {
    render(
      <table>
        <tbody>
          <tr>
            <CrawlPageDiscoveryCell page={samplePage} t={mockT} />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText('mapUi.discovery.sitemap')).toBeTruthy();
  });

  it('renders CrawlPageEvidenceIssues with issue codes', () => {
    render(<CrawlPageEvidenceIssues issues={samplePage.issues} t={mockT} />);
    expect(screen.getByText('crawl.ui.severityValues.warning:')).toBeTruthy();
  });

  it('renders CrawlPageTableRow correctly', () => {
    render(
      <table>
        <tbody>
          <CrawlPageTableRow
            page={samplePage}
            evidenceUrl={null}
            evidenceHref={(url) => `/evidence?url=${encodeURIComponent(url)}`}
            hasRun={true}
            t={mockT}
          />
        </tbody>
      </table>,
    );
    expect(screen.getAllByText('200').length).toBeGreaterThan(0);
    expect(screen.getByText('Test Page')).toBeTruthy();
  });

  it('renders CrawlPageTable empty and populated states', () => {
    const mockSession = {
      activeProjectId: 'proj-1',
      currentRun: 'run-1',
      descending: false,
      evidenceHref: () => '',
      evidenceUrl: null,
      result: { crawl_mode: 'http' },
      setDescending: vi.fn(),
      setSort: vi.fn(),
      sort: 'status',
      t: mockT,
    } as any;

    const { rerender } = render(<CrawlPageTable session={mockSession} rows={[]} />);
    expect(screen.getByText('crawl.ui.noUrlsForFilters')).toBeTruthy();

    rerender(<CrawlPageTable session={mockSession} rows={[samplePage]} />);
    expect(screen.getByText('Test Page')).toBeTruthy();
  });
});
