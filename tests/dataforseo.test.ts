import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATAFORSEO_LANGUAGES, DATAFORSEO_MARKETS, DataForSEOClient, dataForSeoMarket, dataForSeoLanguage, dataForSeoLocation, readDataForSeoTaskLog, normalizeDataForSeoDomain } from '../src/services/dataforseo';
import { DATAFORSEO_LOCATION_CATALOG } from '../src/services/dataforseoCatalog';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

describe('DataForSEOClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps configured countries to DataForSEO locations', () => {
    expect(dataForSeoLocation('PL')).toBe(2616);
    expect(dataForSeoLocation('Poland')).toBe(2616);
    expect(dataForSeoLocation('UK')).toBe(2826);
    expect(dataForSeoLocation('AU')).toBe(2036);
    expect(dataForSeoLanguage('PL', 'pl')).toBe('pl');
    expect(dataForSeoLanguage('PL', 'de')).toBe('pl');
    expect(() => dataForSeoLocation('unknown')).toThrow();
  });

  it('loads the complete provider location catalogue and merges languages per location', () => {
    expect(DATAFORSEO_LOCATION_CATALOG).toHaveLength(116);
    expect(new Set(DATAFORSEO_LOCATION_CATALOG.map((row) => row.locationCode)).size).toBe(94);
    expect(new Set(DATAFORSEO_LOCATION_CATALOG.map((row) => row.languageCode)).size).toBe(46);
    expect(DATAFORSEO_LOCATION_CATALOG.every((row) => row.availableSources.trim().length > 0)).toBe(true);
    expect(DATAFORSEO_LOCATION_CATALOG.every((row) => row.keywords > 0 && row.serps > 0)).toBe(true);
    expect(DATAFORSEO_LOCATION_CATALOG.find((row) => row.locationCode === 2840 && row.languageCode === 'en')).toMatchObject({ keywords: 1257049152, serps: 177058824, locationCodeParent: null });
    expect(DATAFORSEO_MARKETS.length).toBeGreaterThan(60);
    expect(DATAFORSEO_MARKETS.find((market) => market.code === 'US')).toMatchObject({ locationCode: 2840 });
    expect(DATAFORSEO_MARKETS.find((market) => market.code === 'US')?.catalogRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ locationCode: 2840, languageCode: 'en', keywords: 1257049152, serps: 177058824 }),
    ]));
    expect(DATAFORSEO_MARKETS.find((market) => market.code === 'US')?.languages.map((language) => language.code)).toEqual(expect.arrayContaining(['en', 'es']));
    expect(DATAFORSEO_MARKETS.find((market) => market.code === 'CH')?.languages.map((language) => language.code)).toEqual(expect.arrayContaining(['de', 'fr', 'it']));
    expect(DATAFORSEO_MARKETS.find((market) => market.code === 'TW')?.languages).toEqual([{ code: 'zh-TW', label: 'Chinese (Traditional)' }]);
    expect(DATAFORSEO_LANGUAGES.map((language) => language.code)).toEqual(expect.arrayContaining(['sq', 'zh-TW', 'zh-CN', 'nb', 'tl']));
  });

  it('passes the selected rank-tracking language to the SERP task', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [
      { type: 'organic', url: 'https://one.example/page', rank_group: 1, rank_absolute: 1 },
    ] }] }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await new DataForSEOClient('user', 'password').getSerpCompetitors('audyt seo', 2616, 'pl');

    expect(rows).toEqual([expect.objectContaining({ type: 'organic', url: 'https://one.example/page' })]);
    expect(fetchMock.mock.calls[0][0]).toContain('/v3/serp/google/organic/live/regular');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0]).toMatchObject({ location_code: 2616, language_code: 'pl' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0].depth).toBe(100);
  });

  it('returns keyword metrics from a successful live task response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [{ keyword: 'technical seo', search_volume: 1000, cpc: 2.5, competition_index: 42, search_intent_info: { main_intent: 'informational' }, monthly_searches: [{ search_volume: 900 }] }] }] }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const results = await new DataForSEOClient('user', 'password').getKeywordIdeas('technical seo', 2616, 'pl');
    expect(results).toEqual([expect.objectContaining({ keyword: 'technical seo', search_volume: 1000, competition: 0.42, intent: 'Informational' })]);
    expect(results[0].sourceMetrics).toEqual({ searchVolume: 1000, cpc: 2.5, competitionIndex: 42, intent: 'informational', monthlySearches: [{ year: null, month: null, searchVolume: 900 }] });
    expect(fetchMock.mock.calls[0][0]).toContain('/v3/keywords_data/google_ads/keywords_for_keywords/live');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0]).toMatchObject({ keywords: ['technical seo'], location_code: 2616, language_code: 'pl' });
  });

  it('maps the actual Google Ads flat result envelope and distinguishes empty from unknown shapes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ keyword: 'szkolenie linkedin', search_volume: 10, competition_index: 0 }] }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [] }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ unexpected: true }] }] })));
    vi.stubGlobal('fetch', fetchMock);
    const client = new DataForSEOClient('user', 'password');
    expect(await client.getKeywordIdeas('linkedin', 2616, 'pl')).toEqual([expect.objectContaining({ keyword: 'szkolenie linkedin', search_volume: 10, competition: 0 })]);
    expect(await client.getKeywordIdeas('linkedin', 2616, 'pl')).toEqual([]);
    await expect(client.getKeywordIdeas('linkedin', 2616, 'pl')).rejects.toThrow();
  });

  it('retains the organic rows returned with task status 40106 for clustering without a second paid request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 40106, status_message: 'Partial results', result: [{ items: [{ type: 'organic', url: 'https://source.test', rank_absolute: 1 }] }] }] })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await new DataForSEOClient('user', 'password').getSerpCompetitors('seo', 2616, 'pl', true)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('computes dofollow from documented referring link attributes rather than a nonexistent summary field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ backlinks: 100, referring_links_attributes: { nofollow: 20 } }] }] }))));
    expect(await new DataForSEOClient('user', 'password').getBacklinksSummary('example.test')).toMatchObject({ total_backlinks: 100, dofollow_backlinks: 80 });
  });

  it('keeps missing keyword metrics distinct from provider-reported zero values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [{ keyword: 'technical seo', search_volume: 0 }] }] }] }), { status: 200 })));
    const results = await new DataForSEOClient('user', 'password').getKeywordIdeas('technical seo', 2840, 'en');

    expect(results[0].sourceMetrics).toMatchObject({ searchVolume: 0, cpc: null, competitionIndex: null, intent: null, monthlySearches: [] });
  });

  it('surfaces DataForSEO task errors instead of returning invented data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 40100, status_message: 'Authentication failed' }] }), { status: 200 })));
    await expect(new DataForSEOClient('user', 'password').getKeywordIdeas('seo', 2840)).rejects.toThrow('Authentication failed');
  });

  it('rejects a response without a task envelope instead of treating it as empty live data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status_code: 20000 }), { status: 200 })));
    await expect(new DataForSEOClient('user', 'password').getKeywordIdeas('seo', 2840)).rejects.toThrow('no task response');
  });

  it('verifies configured credentials against the account endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status_code: 20000, status_message: 'Ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new DataForSEOClient('user', 'password').verifyCredentials()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toContain('/v3/appendix/user_data');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toMatch(/^Basic /);
  });

  it('retries a transient HTTP 429 when the provider supplies a zero Retry-After', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_message: 'Too many requests' }), { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [] }] }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new DataForSEOClient('user', 'password').getSerpCompetitors('seo')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry an explicit quota/balance response and records the failure without secrets', async () => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'quota-project');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status_message: 'Quota exceeded: insufficient balance' }), { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new DataForSEOClient('user', 'password').getSerpCompetitors('seo')).rejects.toThrow(/quota or rate limit exceeded/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readDataForSeoTaskLog('quota-project')).toEqual([
      expect.objectContaining({ endpoint: '/v3/serp/google/organic/live/regular', statusCode: 429, ok: false }),
    ]);
    expect(localStorage.getItem('seomi_project_quota-project_dataforseo_task_log_v1')).not.toContain('password');
  });

  it('does not retry an explicit provider rate-limit response', async () => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'rate-limit-project');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status_message: 'Rate limit exceeded' }), { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new DataForSEOClient('user', 'password').getSerpCompetitors('seo')).rejects.toMatchObject({
      status: 429,
      quotaExceeded: true,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed task log bound to the project that started the request', async () => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'request-source-project');
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    const request = new DataForSEOClient('user', 'password').getSerpCompetitors('seo');
    await Promise.resolve();
    localStorage.setItem('seomi_active_project_v1', 'new-active-project');
    resolveFetch?.(new Response(JSON.stringify({ status_message: 'Authentication failed' }), { status: 401 }));

    await expect(request).rejects.toThrow('Authentication failed');
    expect(readDataForSeoTaskLog('request-source-project')).toEqual([
      expect.objectContaining({ projectId: 'request-source-project', statusCode: 401, ok: false }),
    ]);
    expect(readDataForSeoTaskLog('new-active-project')).toEqual([]);
  });

  it('does not retry a native IPC quota response', async () => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'native-quota-project');
    invokeMock.mockReset().mockRejectedValue(new Error('HTTP 429 quota exceeded: insufficient balance'));
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });

    try {
      await expect(new DataForSEOClient('user', 'password').getSerpCompetitors('seo')).rejects.toThrow(/quota exceeded/i);
      expect(invokeMock).toHaveBeenCalledTimes(1);
    } finally {
      delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
      invokeMock.mockReset();
    }
  });

  it('persists provider task status, id, cost and duration per active project without secrets', async () => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'project-task-log');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{
      id: 'task-123', status_code: 20000, status_message: 'Ok', cost: 0.0042, time: 0.37,
      result_count: 1, result: [{ items: [] }],
    }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await new DataForSEOClient('user', 'password').getSerpCompetitors('seo', 2840, 'en');

    expect(readDataForSeoTaskLog('project-task-log')).toEqual([
      expect.objectContaining({
        projectId: 'project-task-log',
        endpoint: '/v3/serp/google/organic/live/regular',
        taskId: 'task-123',
        statusCode: 20000,
        cost: 0.0042,
        timeSeconds: 0.37,
        resultCount: 1,
        ok: true,
      }),
    ]);
    const stored = localStorage.getItem('seomi_project_project-task-log_dataforseo_task_log_v1') || '';
    expect(stored).not.toContain('password');
    expect(stored).not.toContain('user');
  });

  it('maps Domain Labs metrics and relevant pages from their documented response fields', async () => {
    const requests: Array<{ url: string; body?: Record<string, unknown>[] }> = [];
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown>[] : undefined;
      requests.push({ url, body });
      let items: Record<string, unknown>[] = [];
      if (url.includes('/domain_rank_overview/')) items = [{ metrics: { organic: { etv: 1200, count: 60 } } }];
      if (url.includes('/ranked_keywords/')) items = [{
        keyword_data: { keyword: 'seo audit', keyword_info: { search_volume: 900 }, search_intent_info: { main_intent: 'informational' } },
        ranked_serp_element: { serp_item: { rank_absolute: 4, etv: 240 } },
      }];
      if (url.includes('/relevant_pages/')) items = [{ page_address: 'https://example.com/audit', metrics: { organic: { etv: 600, count: 12 } } }];
      if (url.includes('/competitors_domain/')) items = [{ domain: 'competitor.example', intersections: 14, avg_position: 13.4 }];
      const result = url.includes('/backlinks/summary/')
        ? [{ backlinks: 50, referring_domains: 10, referring_main_domains: 9, rank: 35, dofollow: 20, broken_backlinks: 0 }]
        : [{ items }];
      return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const overview = await new DataForSEOClient('user', 'password').getDomainOverview('example.com', 2616);

    expect(overview).toMatchObject({
      organic_traffic: 1200,
      organic_keywords: 60,
      top_keywords: [{ keyword: 'seo audit', position: 4, search_volume: 900, traffic_share: 20, intent: 'Informational' }],
      top_pages: [{ url: 'https://example.com/audit', traffic_percentage: 50, keywords_count: 12 }],
      competitors: [{ domain: 'competitor.example', common_keywords: 14, average_position: 13.4 }],
    });
    expect(requests.some(({ url }) => url.includes('/relevant_pages/live'))).toBe(true);
  });

  it('keeps missing domain metrics empty instead of presenting them as real zeroes', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes('/backlinks/summary/')) return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [] }] }), { status: 200 });
      const items = url.includes('/domain_rank_overview/') ? [{ metrics: {} }] : [];
      return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items }] }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const overview = await new DataForSEOClient('user', 'password').getDomainOverview('example.com', 2840);

    expect(overview).toMatchObject({ organic_traffic: null, organic_keywords: null, domain_rank: null, referring_domains: null });
  });

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


describe('domain normalization contract before consolidation', () => {
  it.each([
    ['https://WWW.Example.com.:443/path?query=1', 'example.com'],
    ['https://www.bücher.de:8443/path', 'xn--bcher-kva.de'],
    [' Example.COM ', 'example.com'],
  ])('normalizes %s', (value, expected) => expect(normalizeDataForSeoDomain(value)).toBe(expected));
  it.each(['', 'localhost', 'ftp://example.com', 'https://user:secret@example.com', 'https://[broken'])('rejects %s', (value) => {
    expect(() => normalizeDataForSeoDomain(value)).toThrow();
  });
});
