import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrawlLinksFilters } from '@/components/Domain/crawlResults/linksTab/CrawlLinksFilters';
import { computeCrawlLinksData } from '@/components/Domain/crawlResults/linksTab/crawlLinksTabHelpers';
import type { CrawlLinksTab } from '@/components/Domain/crawlResults/CrawlLinksTab';
import type { CrawledPageSummary } from '@/types';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: Record<string, unknown>) => {
  if (opts && 'count' in opts) return `${key}:${opts.count}`;
  if (opts && 'total' in opts) return `${key}:${opts.visible}/${opts.total}`;
  return key;
}) as unknown as Parameters<typeof CrawlLinksTab>[0]['session']['t'];

describe('CrawlLinksTab modular architecture', () => {
  it('satisfies physical LOC <= 150 across CrawlLinksTab and linksTab submodules', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlLinksTab.tsx',
      ...codeFiles('src/components/Domain/crawlResults/linksTab'),
    ];
    expect(files.length).toBeGreaterThanOrEqual(4);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('computes crawl links data correctly', () => {
    const pages = [
      {
        url: 'https://example.com/page-1',
        final_url: 'https://example.com/page-1',
        redirect_chain: [], http_status: 200, depth: 0,
        issues: [], issues_count: 0,
        content_type: 'text/html', response_time_ms: 100,
        indexability_status: 'indexable', body_truncated: false,
        word_count: 100, schema_types: [], schema_syntax_errors: 0,
        hreflangs: [], h1_count: 1,
        internal_link_count: 1, external_link_count: 1,
        links: [
          { target_url: 'https://example.com/page-2', is_internal: true, anchor_text: 'Page 2', target_http_status: 200 },
          { target_url: 'https://external.com', is_internal: false, anchor_text: 'External' },
        ],
        images: [],
      },
    ] as CrawledPageSummary[];

    const data = computeCrawlLinksData({
      pages, query: '', kind: 'all', status: 'all', sort: 'source', descending: false,
    });

    expect(data.allLinks.length).toBe(2);
    expect(data.internalLinks.length).toBe(1);
    expect(data.externalLinks.length).toBe(1);
    expect(data.uniqueInternalTargets.size).toBe(1);
    expect(data.checkedInternalTargets.size).toBe(1);
    expect(data.brokenInternalTargets.size).toBe(0);
    expect(data.uncheckedInternalCount).toBe(0);
    expect(data.uncheckedExternalCount).toBe(1);
  });

  it('renders CrawlLinksFilters and responds to inputs', () => {
    const setQuery = vi.fn();
    const setDescending = vi.fn();

    render(
      <CrawlLinksFilters
        linkQuery="test"
        setLinkQuery={setQuery}
        linkKind="all"
        setLinkKind={vi.fn()}
        linkStatus="all"
        setLinkStatus={vi.fn()}
        linkSort="source"
        setLinkSort={vi.fn()}
        linkDescending={false}
        setLinkDescending={setDescending}
        navigationRunId="run-1"
        links={[]}
        allLinks={[]}
        t={mockT}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'crawl.ui.searchLink' });
    fireEvent.change(input, { target: { value: 'about' } });
    expect(setQuery).toHaveBeenCalledWith('about');

    const descBtn = screen.getByRole('button', { name: 'crawl.ui.ascending' });
    fireEvent.click(descBtn);
    expect(setDescending).toHaveBeenCalled();
  });
});
