import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CrawlClientRedirects } from '@/components/Domain/crawlResults/CrawlClientRedirects';
import type { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';

type Session = ReturnType<typeof useCrawlResultsSession>;
const t = (key: string, options?: Record<string, unknown>) => (options && 'count' in options ? `${key}:${options.count}` : options?.defaultValue ? `${key}|${options.defaultValue}` : key);
const session = (pages: unknown[]) => ({ result: { pages }, t }) as unknown as Session;

it('shows an explicit empty state when no page declared a client redirect', () => {
  render(<CrawlClientRedirects session={session([{ url: 'https://a.test/' }, { url: 'https://a.test/b', client_redirects: [] }])} />);
  expect(screen.getByText('crawlDeepUi.clientRedirects:0')).toBeTruthy();
  expect(screen.getByText('crawlDeepUi.noClientRedirects')).toBeTruthy();
});

it('lists every declared redirect with its mechanism, delay and resolved target', () => {
  render(<CrawlClientRedirects session={session([
    { url: 'https://a.test/old', client_redirects: [
      { source: 'meta-refresh', declaration: '0; url=/new', delay_seconds: 0, target_url: 'https://a.test/new' },
      { source: 'service-worker', declaration: 'navigate()', delay_seconds: null, target_url: null },
    ] },
  ])} />);
  expect(screen.getByText('crawlDeepUi.clientRedirects:2')).toBeTruthy();
  const rows = screen.getAllByRole('row').slice(1);
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByText(/crawlDeepUi\.mechanismMetaRefresh/)).toBeTruthy();
  expect(within(rows[0]).getByText('0 s')).toBeTruthy();
  expect(within(rows[0]).getByText('https://a.test/new')).toBeTruthy();
  expect(within(rows[1]).getByText('service-worker')).toBeTruthy();
  expect(within(rows[1]).getByText('crawlDeepUi.undetermined')).toBeTruthy();
  expect(within(rows[1]).getByText('crawlDeepUi.noValidHttpTarget')).toBeTruthy();
});
