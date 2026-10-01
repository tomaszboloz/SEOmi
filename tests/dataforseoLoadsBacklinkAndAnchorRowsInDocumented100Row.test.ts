import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataForSEOClient } from '../src/services/dataforseo';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

describe('DataForSEOClient', () => {
afterEach(() => vi.unstubAllGlobals());

it('loads backlink and anchor rows in documented 100-row pages and exposes totals', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown>[] }> = [];
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>[];
      requests.push({ url, body });
      let result: Record<string, unknown>[];
      if (url.includes('/backlinks/summary/')) {
        result = [{ backlinks: 250, referring_domains: 40, referring_main_domains: 38, rank: 30, dofollow: 125, broken_backlinks: 0 }];
      } else if (url.includes('/backlinks/anchors/')) {
        result = [{ total_count: 150, referring_subnets: 12, items: [{ anchor: 'brand', backlinks: 50 }] }];
      } else {
        result = [{ total_count: 250, items: [{ title: 'Source', url_from: 'https://source.example/page', url_to: 'https://example.com/', anchor: 'brand', dofollow: true, rank: 20, first_seen: '2026-01-01' }] }];
      }
      return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new DataForSEOClient('user', 'password');

    const profile = await client.getBacklinkProfile('example.com');
    expect(profile).toMatchObject({
      total_anchor_rows: 150,
      total_backlink_rows: 250,
      anchors: [{ anchor: 'brand', count: 50, percentage: 20 }],
      backlinks: [{ source_url: 'https://source.example/page', anchor_text: 'brand' }],
    });
    expect(requests.find(({ url }) => url.includes('/backlinks/anchors/'))?.body[0]).toMatchObject({ limit: 100, offset: 0 });
    expect(requests.find(({ url }) => url.includes('/backlinks/backlinks/'))?.body[0]).toMatchObject({ limit: 100, offset: 0 });

    await client.getBacklinksPage('example.com', 100);
    await client.getBacklinkAnchorsPage('example.com', 100, 100, 250);
    expect(requests.filter(({ url }) => url.includes('/backlinks/backlinks/')).at(-1)?.body[0]).toMatchObject({ limit: 100, offset: 100 });
    expect(requests.filter(({ url }) => url.includes('/backlinks/anchors/')).at(-1)?.body[0]).toMatchObject({ limit: 100, offset: 100 });
  });

it('returns referring domains that link to competitors but exclude the target domain', async () => {
    let request: { url: string; body: Record<string, unknown>[] } | undefined;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      request = { url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown>[] };
      return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ total_count: 23, items: [
        { domain_intersection: {
          '1': { target: 'ref-a.example', backlinks: 4, rank: 55, backlinks_spam_score: 8 },
          '2': { target: 'ref-a.example', backlinks: 2, rank: 55, backlinks_spam_score: 12 },
        } },
        { domain_intersection: { '2': { target: 'ref-b.example', backlinks: 1, rank: 22, backlinks_spam_score: 3 } } },
      ] }] }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const page = await new DataForSEOClient('user', 'password').getBacklinkGapPage('https://www.mysite.example/path', ['https://one.example/', 'two.example'], 100, 100, false);

    expect(request?.url).toContain('/v3/backlinks/domain_intersection/live');
    expect(request?.body[0]).toMatchObject({
      targets: { '1': 'one.example', '2': 'two.example' },
      exclude_targets: ['mysite.example'],
      intersection_mode: 'partial',
      include_subdomains: false,
      offset: 100,
      limit: 100,
    });
    expect(page).toMatchObject({ totalCount: 23, rawCount: 2, items: [
      { referring_domain: 'ref-a.example', target_backlinks: 0, competitor_backlinks: [{ domain: 'one.example', backlinks: 4, rank: 55 }, { domain: 'two.example', backlinks: 2, rank: 55 }], max_competitor_spam_score: 12 },
      { referring_domain: 'ref-b.example', competitor_backlinks: [{ domain: 'two.example', backlinks: 1, rank: 22 }] },
    ] });
  });

it('limits backlink gap target lists to the documented 20-target request ceiling', async () => {
    const client = new DataForSEOClient('user', 'password');
    const competitors = Array.from({ length: 20 }, (_, index) => `competitor-${index}.example`);
    await expect(client.getBacklinkGapPage('mysite.example', competitors)).rejects.toThrow('at most 19 competitors');
  });
});
