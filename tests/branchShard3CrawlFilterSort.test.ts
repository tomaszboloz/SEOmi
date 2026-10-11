import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { useCrawlFilterState } from '@/components/Domain/crawlResults/session/useCrawlFilterState';
import { emptyCrawlNavigationPreferences, emptyCrawlLinkNavigationPreferences } from '@/components/Domain/crawlResults/crawlResultsHelpers';
import type { SiteCrawlResult } from '@/types';

const page = (url: string, status?: number) => ({ url, final_url: url, title: url, issues: [], depth: 1, response_time_ms: 1, http_status: status, content_type: 'text/html', request_error_kind: status === undefined ? 'DNS' : undefined });
const result = { start_url: 'https://a.test/', pages: [page('https://a.test/dns-b'), page('https://a.test/ok', 200), page('https://a.test/dns-a')], resources: [] } as unknown as SiteCrawlResult;

beforeEach(() => localStorage.clear());

it('sorts by status treating pages without a response as status 0, in either position', () => {
  const view = renderHook(() => useCrawlFilterState('p1', 'run', result, [], emptyCrawlNavigationPreferences(), emptyCrawlLinkNavigationPreferences()));
  act(() => view.result.current.setSort('status'));
  const order = view.result.current.pages.map((item: { url: string }) => item.url.replace('https://a.test/', ''));
  expect(order[2]).toBe('ok');
  expect(new Set(order.slice(0, 2))).toEqual(new Set(['dns-a', 'dns-b']));
  act(() => view.result.current.setDescending(true));
  expect(view.result.current.pages[0].url).toBe('https://a.test/ok');
});
