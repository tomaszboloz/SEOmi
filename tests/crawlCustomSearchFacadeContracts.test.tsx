import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlCustomSearchTab } from '@/components/Domain/crawlResults/CrawlCustomSearchTab';
import { downloadCrawlCustomSearchCsv } from '@/services/export';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import type { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import i18n from '@/i18n';

vi.mock('@/services/export', () => ({ downloadCrawlCustomSearchCsv: vi.fn() }));
type Session = ReturnType<typeof useCrawlResultsSession>;
const search = { id: 'price', name: 'Price', query: '.price', selectorType: 'css', resultType: 'text' } as const;
const run = createCrawlRunFixture();
run.config = { ...run.config, customSearches: [search] };
const makeSession = (patch: Partial<Session> = {}) => ({
  currentRun: run, result: createCrawlResultFixture(), customSearchDisplayLimit: 1,
  setCustomSearchDisplayLimit: vi.fn(), t: i18n.t, ...patch,
} as Session);

describe('direct custom search facade contracts', () => {
  it('distinguishes missing configuration from configured searches with no pages', () => {
    const view = render(<CrawlCustomSearchTab session={makeSession({ currentRun: undefined })} />);
    expect(screen.getByText(i18n.t('crawl.customSearch.notConfigured'))).toBeTruthy();
    view.rerender(<CrawlCustomSearchTab session={makeSession()} />);
    expect(screen.getByText(i18n.t('crawl.customSearch.noPages'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('crawl.customSearch.export') }));
    expect(downloadCrawlCustomSearchCsv).toHaveBeenCalledWith(run);
  });
  it('exports the active run and grows the preview by 200 rows without changing captured data', () => {
    const result = createCrawlResultFixture({ pages: [createCrawlPageFixture({ custom_search_results: [
      { id: 'price', values: ['$10', '$20'], truncated: false },
    ] })] });
    const session = makeSession({ result });
    const view = render(<CrawlCustomSearchTab session={session} />);
    expect(screen.getByText('$10')).toBeTruthy();
    expect(screen.queryByText('$20')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('crawl.customSearch.more', { count: 2 }) }));
    const setter = vi.mocked(session.setCustomSearchDisplayLimit);
    const updater = setter.mock.calls[0][0];
    expect(typeof updater).toBe('function');
    expect((updater as (limit: number) => number)(1)).toBe(201);
    expect((updater as (limit: number) => number)(200)).toBe(400);
    view.rerender(<CrawlCustomSearchTab session={{ ...session, customSearchDisplayLimit: 201 }} />);
    expect(screen.getByText('$20')).toBeTruthy();
    expect(screen.queryByRole('button', { name: i18n.t('crawl.customSearch.more', { count: 2 }) })).toBeNull();
    expect(result.pages[0].custom_search_results?.[0].values).toEqual(['$10', '$20']);
  });
});
