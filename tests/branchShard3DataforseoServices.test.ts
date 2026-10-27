import { beforeEach, expect, it, vi } from 'vitest';
import { parseUserData, readAccount, writeAccount } from '@/services/dataforseo/dataforseoAccount';
import { getDomainOverview } from '@/services/dataforseo/dataforseoDomain';
import type { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';

beforeEach(() => localStorage.clear());

it('reports a null login when the account payload has no string login', () => {
  const body = { tasks: [{ result: [{ login: 42, money: { balance: 10 } }] }] };
  expect(parseUserData(body, '2026-01-01T00:00:00.000Z')).toMatchObject({ login: null, balanceUsd: 10 });
});

it('reads a stored account whose login is not a string as null login', () => {
  localStorage.setItem('seomi_project_p1_dataforseo_account_v1', JSON.stringify({ login: 5, balanceUsd: 3, estimatedBalanceUsd: 2, dailyLimitUsd: null, fetchedAt: 'now' }));
  expect(readAccount('p1')).toEqual({ login: null, balanceUsd: 3, estimatedBalanceUsd: 2, dailyLimitUsd: null, fetchedAt: 'now' });
  writeAccount('p1', readAccount('p1')!);
  expect(readAccount('p1')?.login).toBeNull();
});

const clientFor = (overview: unknown, ranked: unknown[], pages: unknown[]) => ({
  post: vi.fn(async (path: string) => {
    if (path.includes('domain_rank_overview')) return [{ items: [overview] }];
    if (path.includes('ranked_keywords')) return [{ items: ranked }];
    if (path.includes('relevant_pages')) return [{ items: pages }];
    if (path.includes('backlinks/summary')) return [];
    return [{ items: [] }];
  }),
}) as unknown as DataForSEOCore;

it('leaves traffic shares null when keyword or page traffic is missing or total organic traffic is unknown/zero', async () => {
  const missingEtv = await getDomainOverview(clientFor({ metrics: { organic: { etv: 100, count: 1 } } },
    [{ keyword_data: { keyword: 'a', keyword_info: {} }, ranked_serp_element: { serp_item: { rank_absolute: 1 } } }],
    [{ page_address: 'https://x.com/', metrics: { organic: { count: 2 } } }]), 'x.com', 2840);
  expect(missingEtv?.top_keywords[0].traffic_share).toBeNull();
  expect(missingEtv?.top_pages[0].traffic_percentage).toBeNull();

  const unknownTotal = await getDomainOverview(clientFor({ metrics: { organic: { count: 1 } } },
    [{ keyword_data: { keyword: 'a' }, ranked_serp_element: { serp_item: { rank_absolute: 1, etv: 5 } } }],
    [{ page_address: 'https://x.com/', metrics: { organic: { etv: 5 } } }]), 'x.com', 2840);
  expect(unknownTotal?.top_keywords[0].traffic_share).toBeNull();
  expect(unknownTotal?.top_pages[0].traffic_percentage).toBeNull();

  const zeroTotal = await getDomainOverview(clientFor({ metrics: { organic: { etv: 0 } } },
    [{ keyword_data: { keyword: 'a' }, ranked_serp_element: { serp_item: { rank_absolute: 1, etv: 5 } } }],
    [{ page_address: 'https://x.com/', metrics: { organic: { etv: 5 } } }]), 'x.com', 2840);
  expect(zeroTotal?.top_keywords[0].traffic_share).toBeNull();
  expect(zeroTotal?.top_pages[0].traffic_percentage).toBeNull();

  const ok = await getDomainOverview(clientFor({ metrics: { organic: { etv: 100 } } },
    [{ keyword_data: { keyword: 'a' }, ranked_serp_element: { serp_item: { rank_absolute: 1, etv: 5 } } }],
    [{ page_address: 'https://x.com/', metrics: { organic: { etv: 25 } } }]), 'x.com', 2840);
  expect(ok?.top_keywords[0].traffic_share).toBe(5);
  expect(ok?.top_pages[0].traffic_percentage).toBe(25);
});
