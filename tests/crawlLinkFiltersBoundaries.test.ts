import { afterEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import type { CrawledLink } from '@/types';
import { crawlLinkStatus, crawlLinksCsv, filterAndSortCrawlLinks, type CrawlLinkRecord, type CrawlLinkSort } from '@/services/crawlLinkFilters';

const link = (patch: Partial<CrawledLink> = {}): CrawledLink => ({ target_url: 'https://example.com', anchor_text: 'Anchor', is_internal: true, ...patch });
afterEach(() => vi.restoreAllMocks());

it.each([
  [199, 'unchecked'], [200, 'ok'], [299, 'ok'], [300, 'redirect'], [399, 'redirect'],
  [400, 'unverifiable'], [401, 'unverifiable'], [403, 'unverifiable'], [404, 'broken'],
  [410, 'broken'], [429, 'unverifiable'], [500, 'unverifiable'], [999, 'unverifiable'],
] as const)('classifies HTTP boundary %i as %s', (target_http_status, expected) => {
  expect(crawlLinkStatus(link({ target_http_status }))).toBe(expected);
});

it('gives request failures precedence over HTTP and redirects', () => {
  expect(crawlLinkStatus(link({ target_request_error_kind: 'invalid', target_http_status: 200 }))).toBe('unverifiable');
  expect(crawlLinkStatus(link({ target_request_error_kind: 'blocked', target_http_status: 500 }))).toBe('unverifiable');
  expect(crawlLinkStatus(link({ target_request_error_kind: 'timeout', target_redirect_url: 'https://final.test' }))).toBe('unverifiable');
  expect(crawlLinkStatus(link({ target_request_error_kind: 'dns' }))).toBe('broken');
  expect(crawlLinkStatus(link({ target_redirect_url: 'https://final.test' }))).toBe('redirect');
});

const records: CrawlLinkRecord[] = [
  { key: 'b', sourceUrl: 'https://source.test/2', link: link({ anchor_text: 'B', target_url: 'https://target.test/2', target_http_status: 200 }) },
  { key: 'a', sourceUrl: 'https://source.test/1', link: link({ anchor_text: 'A', target_url: 'https://target.test/1', target_http_status: 400, is_internal: false }) },
  { key: 'c', sourceUrl: 'https://source.test/3', link: link({ anchor_text: 'C', target_url: 'https://target.test/3' }) },
];
const filtered = (sort: CrawlLinkSort, descending = false) => filterAndSortCrawlLinks(records, { query: '', kind: 'all', status: 'all', sort, descending }).map(({ key }) => key);

it.each(['source', 'anchor', 'target', 'status'] as const)('sorts %s in both directions without changing the input', (sort) => {
  const ascending = sort === 'status' ? ['b', 'c', 'a'] : ['a', 'b', 'c'];
  const descending = sort === 'status' ? ['a', 'c', 'b'] : ['c', 'b', 'a'];
  expect(filtered(sort)).toEqual(ascending);
  expect(filtered(sort, true)).toEqual(descending);
  expect(records.map(({ key }) => key)).toEqual(['b', 'a', 'c']);
});

it('selects internal links and checks all optional searchable fields', () => {
  expect(filterAndSortCrawlLinks(records, { query: '', kind: 'internal', status: 'all', sort: 'target', descending: false }).map(({ key }) => key)).toEqual(['b', 'c']);
  for (const patch of [{ rel: 'SEARCHME' }, { source_excerpt: 'SEARCHME' }, { target_request_error_kind: 'timeout' as const }, { target_redirect_url: 'https://SEARCHME.test' }]) {
    const record = { key: 'x', sourceUrl: 'https://source.test', link: link(patch) };
    const query = patch.target_request_error_kind ? ' timeout ' : ' searchme ';
    expect(filterAndSortCrawlLinks([record], { query, kind: 'all', status: 'all', sort: 'target', descending: false })).toEqual([record]);
  }
  expect(filterAndSortCrawlLinks(records, { query: 'no-match', kind: 'all', status: 'all', sort: 'target', descending: false })).toEqual([]);
});

it('exports measured and absent values with formula and quote escaping', () => {
  const csv = crawlLinksCsv([
    { key: 'full', sourceUrl: ' =SUM(A1)', link: link({ is_internal: false, anchor_text: 'say "hello"', target_http_status: 0, target_request_error_kind: 'timeout', target_redirect_url: 'https://final.test', target_response_time_ms: 0, target_checked_at: '2026-10-05', rel: 'nofollow', source_excerpt: '<a>' }) },
    { key: 'empty', sourceUrl: 'https://source.test', link: link() },
  ]);
  expect(csv).toContain('"\' =SUM(A1)"');
  expect(csv).toContain('"say ""hello"""');
  expect(csv).toContain('"0","timeout","https://final.test","0","2026-10-05"');
  expect(csv).toContain('"nofollow","<a>"');
  expect(csv.split('\r\n')).toHaveLength(3);
});

it('handles a missing translated header array', () => {
  vi.spyOn(i18n, 't').mockReturnValue('missing');
  expect(crawlLinksCsv([])).toBe('');
});
