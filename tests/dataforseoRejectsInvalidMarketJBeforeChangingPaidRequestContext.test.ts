import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataForSEOClient, dataForSeoMarket, dataForSeoLocation } from '../src/services/dataforseo';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

describe('DataForSEO feedback regressions', () => {
afterEach(() => vi.unstubAllGlobals());

it.each(['', 'unknown', 'Poland (PL)', '-1', '0'])('rejects invalid market %j before changing paid request context', (market) => {
    expect(() => dataForSeoMarket(market)).toThrow();
    expect(() => dataForSeoLocation(market)).toThrow();
  });

it.each([
    [{ backlinks: 100, referring_links_attributes: { nofollow: 0 } }, 100],
    [{ backlinks: 100, referring_links_attributes: { nofollow: 100 } }, 0],
    [{ backlinks: 100, referring_links_attributes: { nofollow: 25 }, dofollow: 99 }, 75],
    [{ backlinks: 100, dofollow: 40 }, 40],
    [{ backlinks: 100 }, null],
  ])('distinguishes documented, legacy and missing dofollow evidence: %j', async (item, expected) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [item] }] })));
    vi.stubGlobal('fetch', fetchMock);
    expect((await new DataForSEOClient('user', 'password').getBacklinksSummary('example.test'))?.dofollow_backlinks).toBe(expected);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([{ target: 'example.test', internal_list_limit: 1000 }]);
  });

it('rounds displayed traffic only, excludes self and outside-top-100 rows, and calculates shares from raw ETV', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = String(input);
      let items: unknown[] = [];
      if (url.includes('/domain_rank_overview/')) items = [{ metrics: { organic: { etv: 10.066, count: 2 } } }];
      if (url.includes('/ranked_keywords/')) items = [1, 101].map((rank) => ({ keyword_data: { keyword: `keyword-${rank}` }, ranked_serp_element: { serp_item: { rank_absolute: rank, etv: 5.033 } } }));
      if (url.includes('/relevant_pages/')) items = [{ page_address: 'https://example.test/a', metrics: { organic: { etv: 5.033 } } }];
      if (url.includes('/competitors_domain/')) items = [{ domain: 'example.test' }, { domain: 'competitor.test' }];
      return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items }] }] }));
    }));
    const result = (await new DataForSEOClient('user', 'password').getDomainOverview('example.test', 2616, 'pl'))!;
    expect(result.organic_traffic).toBe(10);
    expect(result.top_keywords).toMatchObject([{ keyword: 'keyword-1', traffic_share: 50 }]);
    expect(result.top_keywords).toHaveLength(1);
    expect(result.top_pages[0].traffic_percentage).toBe(50);
    expect(result.competitors.map((item) => item.domain)).toEqual(['competitor.test']);
  });
});
