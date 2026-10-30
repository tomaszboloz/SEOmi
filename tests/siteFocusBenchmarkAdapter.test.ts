import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataForSEOSerpItem } from '@/types';

const invoke = vi.hoisted(() => vi.fn());
const listen = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', async (original) => ({ ...(await original<object>()), invokeTauriCommand: invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen }));

import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { competitorCrawlConfig, createBenchmarkDeps, createBriefDeps, createCrawler, createSerpFetcher } from '@/services/siteFocusBenchmark';
import { dataForSeoHits } from '@/services/siteFocusBenchmark/adapter';

const item = (rank: number): DataForSEOSerpItem => ({ type: 'organic', rank_group: rank, rank_absolute: rank, domain: `d${rank}.test`, title: '', description: '', url: `https://d${rank}.test/` });

describe('createSerpFetcher', () => {
  const free = vi.fn();
  const client = { getSerpCompetitors: vi.fn(async () => [item(1), item(2)]) };
  const env = (login: string, password: string) => ({ credentials: { login, password }, country: 'US', language: 'en', dataForSeo: () => client, freeSerp: free as never });
  beforeEach(() => { free.mockReset(); client.getSerpCompetitors.mockClear(); });

  it('uses DataForSEO when credentials exist', async () => {
    const response = await createSerpFetcher(env('a', 'b'))('kw');
    expect(response).toMatchObject({ source: 'dataforseo', hits: dataForSeoHits([item(1), item(2)]) });
    // #85/#86: two organic results are partial evidence, never a TOP 10.
    expect(response.evidence).toMatchObject({ query: 'kw', providerKind: 'dataforseo-live', countryCode: 'US', availability: 'partial', actualK: 2, requestedDepth: 100 });
    expect(client.getSerpCompetitors).toHaveBeenCalledWith('kw', expect.any(Number), 'en');
  });
  it('falls back to the free Bing feed', async () => {
    const source = { provider: 'Bing', countryCode: 'US', languageCode: 'en', retrievedAt: '2026-10-30T00:00:00Z', capturedAt: null, availability: 'partial', reason: 'free-engine' };
    free.mockResolvedValue({ status: 'ok', response: {}, result: { snapshots: [{ rows: [{ rank: 1, url: 'https://x.test/p' }], source }, { rows: [], source }] } });
    const bing = await createSerpFetcher(env('', ''))('kw');
    expect(bing).toMatchObject({ source: 'bing-rss', hits: [{ rank: 1, url: 'https://x.test/p', domain: '' }] });
    expect(bing.evidence).toMatchObject({ providerKind: 'bing-rss', provider: 'Bing', availability: 'partial', actualK: 1, retrievedAt: '2026-10-30T00:00:00Z' });
    expect(await createSerpFetcher(env('a', ' '))('kw')).toMatchObject({ source: 'bing-rss' });
  });
  it('throws readable errors when the free feed fails', async () => {
    free.mockResolvedValue({ status: 'blocked', response: { error: 'denied' }, result: null });
    await expect(createSerpFetcher(env('', ''))('kw')).rejects.toThrow('denied');
    free.mockResolvedValue({ status: 'error', response: { error: null }, result: null });
    await expect(createSerpFetcher(env('', ''))('kw')).rejects.toThrow('error');
    free.mockResolvedValue({ status: 'ok', response: { error: null }, result: null });
    await expect(createSerpFetcher(env('', ''))('kw')).rejects.toThrow('ok');
  });
});

describe('createCrawler', () => {
  const makeEnv = (result: unknown, listenFails = false) => {
    let handler: (p: { runId: string; completed: number }) => void = () => undefined;
    const unlisten = vi.fn();
    const e = {
      invoke: vi.fn(async (command: string) => { if (command === 'cancel_site_crawl') throw new Error('gone'); handler({ runId: 'r1', completed: 4 }); handler({ runId: 'other', completed: 9 }); if (result instanceof Error) throw result; return result; }),
      listen: vi.fn(async (h: typeof handler) => { if (listenFails) throw new Error('no events'); handler = h; return unlisten; }),
      newRunId: () => 'r1',
    };
    return { e: e as never, unlisten, invoke: e.invoke };
  };
  it('crawls with a polite capped config and reports progress', async () => {
    const { e, invoke: inv, unlisten } = makeEnv({ pages: [{ url: 'u' }], cancelled: false });
    const onPages = vi.fn();
    const response = await createCrawler(e)({ url: 'https://c.test/', maxPages: 15, onPages });
    expect(response).toEqual({ pages: [{ url: 'u' }], cancelled: false });
    expect(onPages).toHaveBeenCalledTimes(1);
    expect(onPages).toHaveBeenCalledWith(4);
    expect(inv).toHaveBeenCalledWith('crawl_site', { startUrl: 'https://c.test/', maxPages: 15, runId: 'r1', config: competitorCrawlConfig(15) });
    expect(unlisten).toHaveBeenCalled();
    expect(competitorCrawlConfig(15)).toMatchObject({ respectRobots: true, respectCrawlDelay: true, maxPages: 15, maxConcurrentRequests: 2 });
  });
  it('cancels the native run on abort and tolerates missing events', async () => {
    const { e, invoke: inv } = makeEnv(new Error('crawl died'), true);
    const controller = new AbortController();
    inv.mockImplementationOnce(async () => { controller.abort(); throw new Error('crawl died'); });
    const run = createCrawler(e)({ url: 'https://c.test/', maxPages: 5, signal: controller.signal });
    await expect(run).rejects.toThrow('crawl died');
    expect(inv).toHaveBeenCalledWith('cancel_site_crawl', { runId: 'r1' });
  });
  it('works without progress callback', async () => {
    const { e } = makeEnv({ pages: [], cancelled: true });
    expect(await createCrawler(e)({ url: 'https://c.test/', maxPages: 5 })).toEqual({ pages: [], cancelled: true });
  });
});

describe('real wiring', () => {
  it('builds deps from stores and Tauri', async () => {
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
    const unlisten = vi.fn();
    listen.mockImplementation(async (_name: string, cb: (e: { payload: unknown }) => void) => { cb({ payload: { runId: 'x', completed: 1 } }); return unlisten; });
    invoke.mockResolvedValue({ pages: [], cancelled: false });
    const deps = createBenchmarkDeps();
    expect(deps.fetchSerp).toBeTypeOf('function');
    expect(await deps.crawlSite({ url: 'https://c.test/', maxPages: 3 })).toEqual({ pages: [], cancelled: false });
    expect(listen).toHaveBeenCalledWith('crawl-progress', expect.any(Function));
  });
  it('wires the AI provider path', async () => {
    const generateText = vi.fn().mockResolvedValue('t');
    useAuthStore.setState({ isProviderConnected: () => true, generateText } as never);
    const deps = createBriefDeps();
    expect(deps.isConfigured()).toBe(true);
    expect(await deps.generateText('p')).toBe('t');
    useAuthStore.setState({ isProviderConnected: () => false } as never);
    expect(createBriefDeps().isConfigured()).toBe(false);
  });
});
