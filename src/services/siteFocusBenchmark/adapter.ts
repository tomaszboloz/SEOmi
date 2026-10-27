import type { CrawlConfig, CrawlProgress, DataForSEOSerpItem, SiteCrawlResult } from '@/types';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';
import { DataForSEOClient, dataForSeoLanguage, dataForSeoLocation } from '@/services/dataforseo';
import { fetchFreeSerp } from '@/services/freeSerp';
import { invokeTauriCommand } from '@/services/tauri';
import { createId } from '@/services/ids';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import type { BriefDeps, BriefRequestContext } from './rewriteBrief';
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
  dataForSeo: (login: string, password: string) => Pick<DataForSEOClient, 'getSerpCompetitors'>;
  freeSerp: typeof fetchFreeSerp;
}

/**
 * SERP source order, discovered from the app's existing integrations: DataForSEO live organic results when
 * credentials are saved, otherwise the free Bing RSS feed (partial coverage, labeled as such).
 */
export const createSerpFetcher = (env: SerpEnv): NonNullable<BenchmarkDeps['fetchSerp']> => async (keyword): Promise<SerpResponse> => {
  const { login, password } = env.credentials;
  if (login.trim() && password.trim()) {
    const language = dataForSeoLanguage(env.country, env.language);
    const rows = await env.dataForSeo(login, password).getSerpCompetitors(keyword, dataForSeoLocation(env.country), language);
    return { source: 'dataforseo', hits: dataForSeoHits(rows) };
  }
  const outcome = await env.freeSerp({ feed: 'bing-serp', geo: env.country, language: env.language, keyword });
  if (outcome.status !== 'ok' || !outcome.result) throw new Error(outcome.response.error ?? outcome.status);
  const rows = outcome.result.snapshots.flatMap((snapshot) => snapshot.rows);
  return { source: 'bing-rss', hits: rows.map((row) => ({ rank: row.rank, url: row.url, domain: '' })) };
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
export const createBenchmarkDeps = (): BenchmarkDeps => {
  const tools = useToolsStore.getState();
  return {
    fetchSerp: createSerpFetcher({
      credentials: useSettingsStore.getState().dataForSeoCredentials,
      country: tools.keywordCountry || 'US',
      language: tools.keywordLanguage || 'en',
      dataForSeo: (login, password) => new DataForSEOClient(login, password),
      freeSerp: fetchFreeSerp,
    }),
    crawlSite: createCrawler({ invoke: invokeTauriCommand, listen: listenProgress, newRunId: () => createId('benchmark') }),
  };
};

export class BriefRequestContextMismatchError extends Error {
  readonly code = 'brief-request-context-mismatch';

  constructor(message = 'AI request context does not match the active project') {
    super(message);
    this.name = 'BriefRequestContextMismatchError';
  }
}

const validContextValue = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Rejects scoped requests before auth/API work when the workspace has changed. */
export const assertBriefRequestContext = (context: BriefRequestContext): void => {
  if (!context || ![context.projectId, context.runId, context.chunkId, context.revision].every(validContextValue)) {
    throw new BriefRequestContextMismatchError('AI request context is incomplete');
  }
  if (useProjectStore.getState().activeProjectId !== context.projectId) {
    throw new BriefRequestContextMismatchError();
  }
};

/** AI brief dependencies: same provider, model and key path as the other AI features. */
export const createBriefDeps = (requestContext?: BriefRequestContext): BriefDeps => {
  const auth = useAuthStore.getState();
  return {
    isConfigured: () => auth.isProviderConnected(),
    generateText: async (prompt, context = requestContext) => {
      if (context) assertBriefRequestContext(context);
      return context ? auth.generateText(prompt, context) : auth.generateText(prompt);
    },
  };
};
