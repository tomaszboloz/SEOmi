import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawlHreflangList } from '@/components/Domain/crawlResults/internationalTab/CrawlHreflangList';
import { CrawlSocialMetaTagsCell } from '@/components/Domain/crawlResults/socialTab/CrawlSocialMetaTagsCell';
import { CrawlSocialTable } from '@/components/Domain/crawlResults/socialTab/CrawlSocialTable';
import { CrawlSocialTableRow } from '@/components/Domain/crawlResults/socialTab/CrawlSocialTableRow';
import { SummaryBasicMetricsRows } from '@/components/Domain/crawlResults/summaryMetrics/SummaryBasicMetricsRows';
import { SummarySitemapAndLinkRows } from '@/components/Domain/crawlResults/summaryMetrics/SummarySitemapAndLinkRows';
import { CrawlPageErrorExpandedRow } from '@/components/Domain/siteAudit/pageErrors/CrawlPageErrorExpandedRow';
import { CrawlPageIssuesList } from '@/components/Domain/siteAudit/pageErrors/CrawlPageIssuesList';
import { result } from './fixtures/crawlResultsTabsContracts';
import type { CrawledPageSummary } from '@/types';

const t = ((k: string) => k) as any;
const mockPage = result.pages[0] as unknown as CrawledPageSummary;

describe('unreferenced crawl subcomponents batch 10 direct assertions', () => {
  it('renders CrawlHreflangList directly', () => {
    const hreflangs = [{ language: 'en', target_url: 'https://example.com/en', target_checked_in_run: true, target_http_status: 200, reciprocal_in_run: true, target_canonical_alignment: 'aligned' }] as any;
    render(<CrawlHreflangList hreflangs={hreflangs} t={t} />);
    expect(screen.getByText(/example\.com\/en/i)).toBeDefined();
    expect(screen.getByText(/crawl\.ui\.httpStatus/)).toBeDefined();
    expect(screen.getByText(/crawlDeepUi\.yes/)).toBeDefined();
  });

  it('renders CrawlSocialMetaTagsCell directly', () => {
    const pageWithTags = {
      ...mockPage,
      social_meta_tags: [{ key: 'og:title', content: 'Test Title' }],
    } as CrawledPageSummary;
    render(
      <table>
        <tbody>
          <tr>
            <CrawlSocialMetaTagsCell page={pageWithTags} prefix="og:" t={t} />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText('Test Title')).toBeTruthy();
    expect(screen.queryByText('twitter:title')).toBeNull();
  });

  it('renders CrawlSocialTable directly', () => {
    const { container } = render(<CrawlSocialTable socialPages={[mockPage]} t={t} />);
    expect(container.querySelector('table')?.textContent).toContain('https://example.com/');
  });

  it('renders CrawlSocialTableRow directly', () => {
    const { container } = render(
      <table>
        <tbody>
          <CrawlSocialTableRow page={mockPage} t={t} />
        </tbody>
      </table>,
    );
    expect(container.querySelector('tr')?.textContent).toContain('https://example.com/');
  });

  it('renders SummaryBasicMetricsRows directly', () => {
    const { container } = render(
      <table>
        <tbody>
          <SummaryBasicMetricsRows result={result} t={t} />
        </tbody>
      </table>,
    );
    expect(container.textContent).toContain('https://example.com/');
    expect(container.textContent).toContain('80 / 100');
    expect(container.textContent).toContain('250');
  });

  it('renders SummarySitemapAndLinkRows directly', () => {
    const { container } = render(
      <table>
        <tbody>
          <SummarySitemapAndLinkRows
            result={result}
            sitemapOnlyCount={0}
            crawlOnlyCount={0}
            t={t}
          />
        </tbody>
      </table>,
    );
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('crawl.ui.internalLinks');
  });

  it('renders CrawlPageErrorExpandedRow directly', () => {
    const { container } = render(
      <table>
        <tbody>
          <CrawlPageErrorExpandedRow page={mockPage} t={t} />
        </tbody>
      </table>,
    );
    expect(container.textContent).toContain('logo.webp');
    expect(container.textContent).toContain('crawlIssues.technicalDetail');
  });

  it('renders CrawlPageIssuesList directly', () => {
    const issues = [{ severity: 'Critical' as const, message: 'Missing <title> tag' }];
    const { container } = render(
      <CrawlPageIssuesList redirectChain={[]} issues={issues} t={t} />,
    );
    expect(container.textContent).toContain('siteAudit.severityValues.Critical');
    expect(container.textContent).toContain('auditIssues.messages.meta_title_missing');
  });
});
