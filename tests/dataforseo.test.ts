import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATAFORSEO_LANGUAGES, DATAFORSEO_MARKETS, DataForSEOClient, dataForSeoLanguage, dataForSeoLocation, readDataForSeoTaskLog } from '../src/services/dataforseo';
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
});
