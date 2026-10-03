import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildCustomSearchRows } from '@/components/Domain/crawlResults/customSearch/customSearchRows';
import { CustomSearchHeaderCard } from '@/components/Domain/crawlResults/customSearch/CustomSearchHeaderCard';
import { CustomSearchConfigCards } from '@/components/Domain/crawlResults/customSearch/CustomSearchConfigCards';
import { CustomSearchTable } from '@/components/Domain/crawlResults/customSearch/CustomSearchTable';
import { CrawlCustomSearchTab } from '@/components/Domain/crawlResults/CrawlCustomSearchTab';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';

const mockT = (key: string, params?: Record<string, unknown>) => {
  if (params?.count !== undefined) return `${key}:${params.count}`;
  return key;
};

describe('CrawlCustomSearchTab and submodules', () => {
  const dummySearches = [
    { id: 'cs1', name: 'Price', query: '.price', selectorType: 'css', resultType: 'text' },
    { id: 'cs2', name: 'Meta robots', query: 'robots', selectorType: 'xpath', resultType: 'attribute', attribute: 'content' },
  ];

  it('buildCustomSearchRows handles missing, error, empty, and populated extractions', () => {
    const pages: CrawledPageSummary[] = [
      {
        url: 'https://example.com/a',
        custom_search_results: [
          { id: 'cs1', values: ['10 USD', '20 USD'], truncated: false },
          { id: 'cs2', values: [], truncated: false, error: 'invalid xpath' },
        ],
      } as unknown as CrawledPageSummary,
      {
        url: 'https://example.com/b',
        custom_search_results: [
          { id: 'cs1', values: [], truncated: false },
        ],
      } as unknown as CrawledPageSummary,
    ];

    const rows = buildCustomSearchRows(pages, dummySearches, mockT);
    expect(rows.length).toBe(5);
    expect(rows[0].value).toBe('10 USD');
    expect(rows[0].match).toBe('1');
    expect(rows[1].value).toBe('20 USD');
    expect(rows[1].match).toBe('2');
    expect(rows[2].value).toBe('invalid xpath');
    expect(rows[3].value).toBe('—');
    expect(rows[4].status).toBe('crawl.customSearch.oldRun');
  });

  it('renders CustomSearchHeaderCard and triggers onExport', () => {
    const onExport = vi.fn();
    render(
      <CustomSearchHeaderCard
        searchesCount={2}
        currentRun={{ id: 'run1' } as CrawlRunRecord}
        onExport={onExport}
        t={mockT}
      />
    );
    expect(screen.getByText('crawl.customSearch.previewTitle:2')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'crawl.customSearch.export' }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('renders CustomSearchConfigCards with search details', () => {
    render(<CustomSearchConfigCards searches={dummySearches} t={mockT} />);
    expect(screen.getByText(/Price · text/)).toBeDefined();
    expect(screen.getByText(/CSS: \.price/)).toBeDefined();
    expect(screen.getByText(/Meta robots · attribute \(content\)/)).toBeDefined();
  });

  it('renders CustomSearchTable and handles load more button', () => {
    const onLoadMore = vi.fn();
    const rows = [
      { key: '1', url: 'https://example.com', search: dummySearches[0], value: '$19', match: '1', status: 'ok' },
      { key: '2', url: 'https://example.com/2', search: dummySearches[0], value: '$29', match: '2', status: 'ok' },
    ];
    render(
      <CustomSearchTable
        rows={rows}
        displayLimit={1}
        onLoadMore={onLoadMore}
        t={mockT}
      />
    );
    expect(screen.getByText('$19')).toBeDefined();
    expect(screen.queryByText('$29')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'crawl.customSearch.more:2' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('renders CrawlCustomSearchTab empty state when no searches configured', () => {
    const session = {
      currentRun: { config: { customSearches: [] } } as unknown as CrawlRunRecord,
      customSearchDisplayLimit: 100,
      result: { pages: [] },
      setCustomSearchDisplayLimit: vi.fn(),
      t: mockT,
    };
    render(<CrawlCustomSearchTab session={session as any} />);
    expect(screen.getByText('crawl.customSearch.notConfigured')).toBeDefined();
  });
});
