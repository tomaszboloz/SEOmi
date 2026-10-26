import { describe, expect, it, vi } from 'vitest';
import {
  DATAFORSEO_SERP_VOLATILITY_URL, GOOGLE_SEARCH_STATUS_URL, fetchGoogleSearchUpdateWindows, fetchSerpVolatility,
  liveFetcher, parseGoogleSearchStatus, parseSerpVolatility,
} from '@/services/causalMarket';

const response = (body: unknown, ok = true): Response => ({ ok, json: async () => body } as Response);

describe('causal market external sources', () => {
  it('parses the public SERP volatility series and category metric', () => {
    const payload = [
      { date: '2026-03-02T00:00:00', main_metric: { volatility: 3 }, other_metrics: [{ category: 10011, volatility: 5 }] },
      { date: '2026-03-01', main_metric: { volatility: 2 }, other_metrics: [] },
      { date: 'bad', main_metric: { volatility: 2 } },
      { date: '2026-03-03', main_metric: { volatility: 0 }, other_metrics: [{ category: 10011, volatility: 4 }] },
    ];
    expect(parseSerpVolatility(payload)).toEqual([{ date: '2026-03-01', level: 2 }, { date: '2026-03-02', level: 3 }]);
    expect(parseSerpVolatility(payload, 10011)).toEqual([{ date: '2026-03-02', level: 5 }, { date: '2026-03-03', level: 4 }]);
    expect(parseSerpVolatility({})).toEqual([]);
    expect(parseSerpVolatility([null, 'invalid', { date: '2026-03-04', main_metric: { volatility: '2' } }])).toEqual([]);
  });

  it('loads the live market source and reports honest failures', async () => {
    let request: RequestInit | undefined;
    const loaded = await fetchSerpVolatility({ fetcher: async (input, init) => {
      expect(input).toBe(DATAFORSEO_SERP_VOLATILITY_URL); request = init; return response([{ date: '2026-03-01', main_metric: { volatility: 2 } }]);
    } });
    expect(loaded).toMatchObject({ status: 'available', source: 'dataforseo-serp-volatility' });
    expect(String(request?.body)).toContain('action=dfs_serp_sensor');
    await expect(fetchSerpVolatility({ fetcher: async () => response([], true) })).resolves.toMatchObject({ status: 'unknown', reason: 'empty' });
    await expect(fetchSerpVolatility({ fetcher: async () => response({}, true) })).resolves.toMatchObject({ status: 'unknown', reason: 'empty' });
    await expect(fetchSerpVolatility({ fetcher: async () => response({}, false) })).resolves.toMatchObject({ status: 'unavailable', reason: 'http' });
    await expect(fetchSerpVolatility({ fetcher: async () => { throw new Error('offline'); } })).resolves.toMatchObject({ status: 'unavailable', reason: 'network' });
  });

  it('parses only dated Google ranking update windows', () => {
    expect(parseGoogleSearchStatus([
      { service_name: 'Ranking', begin: '2026-03-01T00:00:00Z', end: '2026-03-05T00:00:00Z', external_desc: 'Core update' },
      { service_name: 'Ranking', begin: '2026-03-10T00:00:00Z', end: null, external_desc: 'Ongoing Core Update' },
      { affected_products: [{ title: 'Ranking' }], begin: '2026-03-07' },
      { service_name: 'Ranking', begin: '2026-03-01', end: 'invalid' },
      { service_name: 'Ranking', begin: '2026-03-01', end: '2026-02-31' },
      { service_name: 'Ranking', begin: '2026-03-01', end: 123 },
      { service_name: 'Ads', begin: '2026-03-01', end: '2026-03-02' },
      { service_name: 'Ranking', begin: 'bad', end: '2026-03-02' },
      { service_name: 'Ranking', begin: '2026-03-03', end: '2026-03-02' },
    ])).toEqual([
      { start: '2026-03-01', end: '2026-03-05', label: 'Core update', source: GOOGLE_SEARCH_STATUS_URL },
      { start: '2026-03-10', end: null, label: 'Ongoing Core Update', source: GOOGLE_SEARCH_STATUS_URL },
      { start: '2026-03-07', end: null, source: GOOGLE_SEARCH_STATUS_URL },
    ]);
    expect(parseGoogleSearchStatus(null)).toEqual([]);
  });

  it('loads update windows with available, empty, HTTP and network states', async () => {
    const loaded = await fetchGoogleSearchUpdateWindows(async input => {
      expect(input).toBe(GOOGLE_SEARCH_STATUS_URL);
      return response([{ service_name: 'Ranking', begin: '2026-03-01', end: '2026-03-02' }]);
    });
    expect(loaded.status).toBe('available');
    await expect(fetchGoogleSearchUpdateWindows(async () => response([]))).resolves.toMatchObject({ status: 'unknown', reason: 'empty' });
    await expect(fetchGoogleSearchUpdateWindows(async () => response({}, false))).resolves.toMatchObject({ status: 'unavailable', reason: 'http' });
    await expect(fetchGoogleSearchUpdateWindows(async () => { throw new Error('offline'); })).resolves.toMatchObject({ status: 'unavailable', reason: 'network' });
  });

  it('returns unavailable when the runtime has no fetch transport', async () => {
    expect(liveFetcher()).toBeTypeOf('function');
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', undefined);
    expect(liveFetcher()).toBeNull();
    await expect(fetchSerpVolatility()).resolves.toMatchObject({ status: 'unavailable', reason: 'network' });
    await expect(fetchGoogleSearchUpdateWindows()).resolves.toMatchObject({ status: 'unavailable', reason: 'network' });
    vi.stubGlobal('fetch', original);
  });
});
