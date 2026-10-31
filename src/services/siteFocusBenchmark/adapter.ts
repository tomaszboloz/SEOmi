import type { CrawlConfig, CrawlProgress, DataForSEOSerpItem, SiteCrawlResult } from '@/types';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';
import { DataForSEOClient, dataForSeoLanguage, dataForSeoLocation } from '@/services/dataforseo';
import { fetchFreeSerp } from '@/services/freeSerp';
import { evidenceFromLive, evidenceFromSnapshot } from '@/services/serpSnapshot';
import { invokeTauriCommand } from '@/services/tauri';
import { createId } from '@/services/ids';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToolsStore } from '@/stores/toolsStore';
import type { BriefDeps } from './rewriteBrief';
import type { BenchmarkDeps, CrawlRequest, CrawlResponse, SerpHit, SerpResponse } from './types';

/** Polite, capped competitor crawl: robots and crawl-delay honored, low concurrency, bounded run time. */
export const competitorCrawlConfig = (maxPages: number): CrawlConfig => ({
  ...DEFAULT_CRAWL_CONFIG,
  maxPages,
  maxDepth: 3,
  respectRobots: true,
  respectCrawlDelay: true,
  allowSubdomains: false,
  maxConcurrentRequests: 2,
  maxRunSeconds: 120,
  crawlImages: false,
  crawlStylesheets: false,
  crawlScripts: false,
  crawlOtherResources: false,
});

export const dataForSeoHits = (items: DataForSEOSerpItem[]): SerpHit[] =>
  items.map((item) => ({ rank: item.rank_group, url: item.url, domain: item.domain }));

export interface SerpEnv {
  credentials: { login: string; password: string };
  country: string;
  language: string;
  dataForSeo: (login: string, password: string) => Pick<DataForSEOClient, 'getSerpCompetitors'> & Partial<Pick<DataForSEOClient, 'getSerpWithQuestions'>>;
  /** Opt-in: ask DataForSEO for the advanced SERP so the real People Also Ask block is kept (separately billed). */
  withQuestions?: boolean;
  freeSerp: typeof fetchFreeSerp;
  now?: () => string;
}

/** Depth requested in `getSerpCompetitors` (organic live, depth 100). */
const DATAFORSEO_SERP_DEPTH = 100;
const nowIso = (): string => new Date().toISOString();

/**
 * SERP source order, discovered from the app's existing integrations: DataForSEO live organic results when
 * credentials are saved, otherwise the free Bing RSS feed (partial coverage, labeled as such).
 */
export const createSerpFetcher = (env: SerpEnv): NonNullable<BenchmarkDeps['fetchSerp']> => async (keyword): Promise<SerpResponse> => {
  const { login, password } = env.credentials;
  if (login.trim() && password.trim()) {
    const language = dataForSeoLanguage(env.country, env.language);
    const client = env.dataForSeo(login, password);
    const location = dataForSeoLocation(env.country);
    const advanced = env.withQuestions && client.getSerpWithQuestions ? await client.getSerpWithQuestions(keyword, location, language) : null;
    const rows = advanced ? advanced.organic : await client.getSerpCompetitors(keyword, location, language);
    const evidence = evidenceFromLive(keyword, rows.map((row) => row.url), {
      countryCode: env.country || null, languageCode: language || null, requestedDepth: DATAFORSEO_SERP_DEPTH, retrievedAt: (env.now ?? nowIso)(),
    });
    return { source: 'dataforseo', hits: dataForSeoHits(rows), evidence, ...(advanced ? { questions: advanced.questions } : {}) };
  }
  const outcome = await env.freeSerp({ feed: 'bing-serp', geo: env.country, language: env.language, keyword });
  if (outcome.status !== 'ok' || !outcome.result) throw new Error(outcome.response.error ?? outcome.status);
  const rows = outcome.result.snapshots.flatMap((snapshot) => snapshot.rows);
  const evidence = evidenceFromSnapshot(keyword, outcome.result.snapshots[0], 'bing-rss');
  return { source: 'bing-rss', hits: rows.map((row) => ({ rank: row.rank, url: row.url, domain: '' })), evidence };
};

export interface CrawlEnv {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  listen: (handler: (progress: CrawlProgress) => void) => Promise<() => void>;
  newRunId: () => string;
}

/** Wraps the existing `crawl_site` / `cancel_site_crawl` commands; abort cancels the native run. */
export const createCrawler = (env: CrawlEnv): BenchmarkDeps['crawlSite'] => async (request: CrawlRequest): Promise<CrawlResponse> => {
  const runId = env.newRunId();
  const unlisten = await env.listen((progress) => {
    if (progress.runId === runId) request.onPages?.(progress.completed);
  }).catch(() => () => undefined);
  const cancel = (): void => { void env.invoke('cancel_site_crawl', { runId }).catch(() => undefined); };
  request.signal?.addEventListener('abort', cancel, { once: true });
  try {
    const result = await env.invoke<SiteCrawlResult>('crawl_site', { startUrl: request.url, maxPages: request.maxPages, runId, config: competitorCrawlConfig(request.maxPages) });
    return { pages: result.pages, cancelled: result.cancelled };
  } finally {
    request.signal?.removeEventListener('abort', cancel);
    unlisten();
  }
};

const listenProgress = async (handler: (progress: CrawlProgress) => void): Promise<() => void> => {
  const { listen } = await import('@tauri-apps/api/event');
  return listen<CrawlProgress>('crawl-progress', (event) => handler(event.payload));
};

/** The single place that wires stores and Tauri commands into the pure orchestrator. */
export const createBenchmarkDeps = (options: { withQuestions?: boolean } = {}): BenchmarkDeps => {
  const tools = useToolsStore.getState();
  return {
    fetchSerp: createSerpFetcher({
      credentials: useSettingsStore.getState().dataForSeoCredentials,
      country: tools.keywordCountry || 'US',
      language: tools.keywordLanguage || 'en',
      dataForSeo: (login, password) => new DataForSEOClient(login, password),
      freeSerp: fetchFreeSerp,
      withQuestions: options.withQuestions,
    }),
    crawlSite: createCrawler({ invoke: invokeTauriCommand, listen: listenProgress, newRunId: () => createId('benchmark') }),
  };
};

/** AI brief dependencies: same provider, model and key path as the other AI features. */
export const createBriefDeps = (): BriefDeps => {
  const auth = useAuthStore.getState();
  return { isConfigured: () => auth.isProviderConnected(), generateText: (prompt) => auth.generateText(prompt) };
};
