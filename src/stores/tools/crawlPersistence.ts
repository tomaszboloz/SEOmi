
import { SiteCrawlResult, CrawlConfig, CrawlRequestProfile } from '@/types';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';

import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';

import type { CrawlProjectSettings, InterruptedCrawl } from './contracts';
import { crawlSettingsKey, crawlRequestProfilesKey, interruptedCrawlKey, activeProjectId } from './storageKeys';

export const normalizeCrawlLinkUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
};

export const normalizeInterruptedCrawl = (value: unknown): InterruptedCrawl | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<InterruptedCrawl>;
  if (typeof candidate.url !== 'string' || !candidate.url.trim() || typeof candidate.limit !== 'number' || !Number.isFinite(candidate.limit) || !candidate.config || typeof candidate.config !== 'object') return null;
  const environment = candidate.environment === 'staging' || candidate.environment === 'production' ? candidate.environment : 'default';
  const startedAt = typeof candidate.startedAt === 'string' && Number.isFinite(Date.parse(candidate.startedAt))
    ? candidate.startedAt
    : new Date(0).toISOString();
  const updatedAt = typeof candidate.updatedAt === 'string' && Number.isFinite(Date.parse(candidate.updatedAt))
    ? candidate.updatedAt
    : startedAt;
  return {
    url: candidate.url,
    limit: Math.max(1, Math.min(5000, Math.floor(candidate.limit))),
    config: candidate.config as CrawlConfig,
    environment,
    startedAt,
    updatedAt,
    completedUrls: Array.isArray(candidate.completedUrls) ? candidate.completedUrls.filter((item): item is string => typeof item === 'string').slice(0, 20_000) : undefined,
    frontierUrls: Array.isArray(candidate.frontierUrls) ? candidate.frontierUrls.filter((item): item is string => typeof item === 'string').slice(0, 20_000) : undefined,
    baseRunId: typeof candidate.baseRunId === 'string' ? candidate.baseRunId : undefined,
  };
};

export const interruptedCrawlTimestamp = (value: InterruptedCrawl): number => {
  const timestamp = Date.parse(value.updatedAt || value.startedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const newestInterruptedCrawl = (...values: Array<InterruptedCrawl | null>): InterruptedCrawl | null => values
  .filter((value): value is InterruptedCrawl => Boolean(value))
  .sort((left, right) => interruptedCrawlTimestamp(right) - interruptedCrawlTimestamp(left))[0] || null;

export const readInterruptedCrawl = (projectId: string): InterruptedCrawl | null => normalizeInterruptedCrawl(
  readJsonStorage<Partial<InterruptedCrawl> | null>(interruptedCrawlKey(projectId), null),
);

export const interruptedCrawlWrites = new Map<string, Promise<void>>();

export const activeCrawlRuns = new Map<string, string>();

export const persistInterruptedCrawl = (projectId: string, value: InterruptedCrawl | null): void => {
  if (value) writeJsonStorage(interruptedCrawlKey(projectId), value);
  else removeStorage(interruptedCrawlKey(projectId));

  // Keep a native copy as well. Desktop WebViews can reject localStorage or
  // evict it under pressure, while the project crawl directory is already the
  // durable home for crawl history. Queue writes per project so a final clear
  // can never overtake the checkpoint created at crawl start.
  if (!isTauriEnvironment()) return;
  const previous = interruptedCrawlWrites.get(projectId) || Promise.resolve();
  const next = previous.then(async () => {
    try {
      if (value) {
        await invokeTauriCommand('save_project_crawl_checkpoint', { projectId, checkpoint: value });
      } else {
        await invokeTauriCommand('delete_project_crawl_checkpoint', { projectId });
      }
    } catch {
      // localStorage remains the compatibility fallback; the crawl itself must
      // not be marked failed solely because checkpoint backup is unavailable.
    }
  });
  interruptedCrawlWrites.set(projectId, next);
  void next.then(() => {
    if (interruptedCrawlWrites.get(projectId) === next) interruptedCrawlWrites.delete(projectId);
  });
};

export const checkpointUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
};

export const buildCrawlCheckpoint = (result: SiteCrawlResult): Pick<InterruptedCrawl, 'completedUrls' | 'frontierUrls'> => {
  const completed = new Set(
    result.pages
      .flatMap((page) => [page.url, page.final_url])
      .filter(Boolean)
      .map(checkpointUrl),
  );
  const frontier = new Set<string>();
  for (const url of result.sitemap_urls || []) frontier.add(checkpointUrl(url));
  for (const page of result.pages) {
    for (const link of page.links || []) frontier.add(checkpointUrl(link.target_url));
  }
  frontier.delete('');
  for (const url of completed) frontier.delete(url);
  return {
    completedUrls: [...completed].slice(0, 20_000),
    frontierUrls: [...frontier].slice(0, 20_000),
  };
};

export const mergeCrawlResults = (base: SiteCrawlResult, fresh: SiteCrawlResult): SiteCrawlResult => {
  const pagesByUrl = new Map<string, SiteCrawlResult['pages'][number]>();
  for (const page of base.pages) pagesByUrl.set(checkpointUrl(page.final_url || page.url), page);
  for (const page of fresh.pages) pagesByUrl.set(checkpointUrl(page.final_url || page.url), page);
  const pages = [...pagesByUrl.values()];
  const criticalCount = pages.flatMap((page) => page.issues || []).filter((issue) => issue.severity === 'Critical').length;
  const warningCount = pages.flatMap((page) => page.issues || []).filter((issue) => issue.severity === 'Warning').length;
  const noticeCount = pages.flatMap((page) => page.issues || []).filter((issue) => issue.severity === 'Info').length;
  const healthScore = Math.max(20, 100 - Math.min(80, criticalCount * 15 + warningCount * 5));
  const sitemapUrls = [...new Set([...(base.sitemap_urls || []), ...(fresh.sitemap_urls || [])])];
  const rejected = new Map<string, { url: string; reason: string }>();
  for (const item of [...(base.rejected_urls || []), ...(fresh.rejected_urls || [])]) rejected.set(`${item.url}\n${item.reason}`, item);
  const resources = new Map<string, NonNullable<SiteCrawlResult['resources']>[number]>();
  for (const resource of [...(base.resources || []), ...(fresh.resources || [])]) resources.set(checkpointUrl(resource.url), resource);
  return {
    ...fresh,
    start_url: base.start_url || fresh.start_url,
    pages_crawled: pages.length,
    health_score: healthScore,
    critical_count: criticalCount,
    warning_count: warningCount,
    notice_count: noticeCount,
    pages,
    duration_ms: base.duration_ms + fresh.duration_ms,
    sitemap_urls_discovered: sitemapUrls.length,
    sitemap_urls: sitemapUrls,
    rejected_urls: [...rejected.values()],
    resources: [...resources.values()],
    resource_limit_reached: Boolean(base.resource_limit_reached || fresh.resource_limit_reached),
  };
};

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  crawlMode: 'http',
  renderWaitForSelector: '',
  renderWaitDelayMs: 0,
  renderLazyScrollCycles: 0,
  includePatterns: [],
  excludePatterns: [],
  allowSubdomains: false,
  allowedHosts: [],
  scopePath: undefined,
  keepQueryStrings: false,
  respectRobots: true,
  respectCrawlDelay: true,
  discoverSitemaps: true,
  maxRedirects: 10,
  followNofollow: false,
  maxResponseBytes: 5_000_000,
  maxRunSeconds: 300,
  requestTimeoutSecs: undefined,
  verifySsl: true,
  seedUrls: [],
  listMode: false,
  userAgent: '',
  requestProfileId: undefined,
  trimTrailingSlash: false,
  lowercasePath: false,
  stripTrackingParameters: false,
  allowedQueryParameters: [],
  deniedQueryParameters: [],
  customSearches: [],
  focusPhrase: '',
  crawlImages: false,
  crawlStylesheets: false,
  crawlScripts: false,
  crawlOtherResources: false,
  maxResourceRequests: 250,
  maxConcurrentRequests: 4,
};

export const loadCrawlRequestProfiles = (): CrawlRequestProfile[] => {
  const projectId = activeProjectId();
  if (!projectId) return [];
  const raw = readJsonStorage<unknown>(crawlRequestProfilesKey(projectId), []);
  return Array.isArray(raw)
    ? raw.filter((profile): profile is CrawlRequestProfile => Boolean(
      profile && typeof profile.id === 'string' && typeof profile.name === 'string' && typeof profile.userAgent === 'string'
        && typeof profile.createdAt === 'string' && typeof profile.updatedAt === 'string',
    )).map((profile) => ({
      ...profile,
      hasProxy: Boolean(profile.hasProxy),
      hasHeaders: Boolean(profile.hasHeaders),
      hasCookie: Boolean(profile.hasCookie),
    }))
    : [];
};

export const persistCrawlRequestProfiles = (profiles: CrawlRequestProfile[]) => {
  const projectId = activeProjectId();
  if (projectId) writeJsonStorage(crawlRequestProfilesKey(projectId), profiles);
};

export const persistCrawlSettings = (settings: CrawlProjectSettings) => {
  const projectId = activeProjectId();
  if (projectId) writeJsonStorage(crawlSettingsKey(projectId), settings);
};