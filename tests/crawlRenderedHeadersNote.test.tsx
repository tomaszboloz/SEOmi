import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlResultsHeader } from '@/components/Domain/crawlResults/CrawlResultsHeader';
import { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import type { SiteCrawlResult } from '@/types';
import { result, run } from './fixtures/crawlResultsTabsContracts';
import i18n from '@/i18n';

function Header({ crawl }: { crawl: SiteCrawlResult }) {
  const selectedRun = { ...run, result: crawl };
  const session = useCrawlResultsSession({ result: crawl, runs: [selectedRun], selectedRun, onSelectRun: vi.fn() });
  return <section ref={session.resultsRef}><CrawlResultsHeader session={session} /></section>;
}
const crawl = (crawlMode: SiteCrawlResult['crawl_mode'], headersAvailable?: boolean): SiteCrawlResult => ({
  ...result,
  crawl_mode: crawlMode,
  pages: result.pages.map((page) => ({
    ...page,
    robots_decision: headersAvailable === undefined ? undefined : {
      indexability: 'index', link_following: 'follow', response_headers_available: headersAvailable,
    },
  })),
});
const note = () => screen.queryByText(i18n.t('crawlDeepUi.renderedDomNote'));

describe('rendered crawl response-header note', () => {
  it.each([
    ['a bare rendered snapshot without response headers', crawl('browser-rendered', false)],
    ['a rendered run saved before robots decisions were recorded', crawl('browser-rendered')],
  ])('warns that headers are unavailable for %s', (_label, saved) => {
    render(<Header crawl={saved} />);
    expect(note()).toBeTruthy();
  });

  it.each([
    ['a rendered run paired with its HTTP responses', crawl('browser-rendered', true)],
    ['an HTTP run', crawl('http', true)],
  ])('does not claim missing headers for %s', (_label, saved) => {
    render(<Header crawl={saved} />);
    expect(screen.getByText(saved.start_url)).toBeTruthy();
    expect(note()).toBeNull();
  });

  it('warns when a rendered run contains both known and unknown response headers', () => {
    const mixed = crawl('browser-rendered', true);
    mixed.pages[1] = {
      ...mixed.pages[1],
      robots_decision: {
        indexability: 'index',
        link_following: 'follow',
        response_headers_available: false,
      },
    };
    render(<Header crawl={mixed} />);
    expect(note()).toBeTruthy();
  });
});
