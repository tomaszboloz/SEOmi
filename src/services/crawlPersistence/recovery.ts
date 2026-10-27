import type { CrawlConfig, CrawledPageSummary } from '@/types';
import type { InterruptedCrawl } from '@/stores/tools/contracts';
import type { CrawlEvent } from '@/services/snapshots';

export interface RecoveredCrawlResult {
  start_url: string;
  pages: CrawledPageSummary[];
  pages_crawled: number;
  cancelled: boolean;
  timed_out: boolean;
  health_score?: number;
  duration_ms?: number;
  critical_count?: number;
  warning_count?: number;
  notice_count?: number;
  sitemap_urls?: string[];
}

export interface RecoveredActiveCrawlRun {
  id: string;
  projectId: string;
  status: 'in-flight' | 'interrupted';
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
  startUrl: string;
  config?: CrawlConfig;
  result: RecoveredCrawlResult;
  environment?: 'default' | 'staging' | 'production';
}

const payload = (event: CrawlEvent): Record<string, unknown> => event.payload && typeof event.payload === 'object'
  ? event.payload as Record<string, unknown> : {};
const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;
const finite = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const reconstructInFlightRun = (projectId: string, runId: string, events: readonly CrawlEvent[]): RecoveredActiveCrawlRun => {
  const started = events.find((event) => event.type === 'crawl:started');
  const startPayload = started ? payload(started) : {};
  const startUrl = text(startPayload.startUrl) || '';
  const pages = events.filter((event) => event.type === 'crawl:page').map((event) => event.payload).filter((value): value is CrawledPageSummary => Boolean(value && typeof value === 'object' && text((value as Record<string, unknown>).url)));
  const terminal = [...events].reverse().find((event) => ['crawl:completed', 'crawl:cancelled', 'crawl:timed_out', 'crawl:interrupted'].includes(event.type));
  const terminalPayload = terminal ? payload(terminal) : {};
  const startedAt = started && Number.isFinite(Date.parse(started.at)) ? started.at : undefined;
  const updatedAt = events.at(-1)?.at && Number.isFinite(Date.parse(events.at(-1)!.at)) ? events.at(-1)!.at : undefined;
  const eventDuration = startedAt && updatedAt ? Math.max(0, Date.parse(updatedAt) - Date.parse(startedAt)) : undefined;
  const config = startPayload.config && typeof startPayload.config === 'object' ? startPayload.config as CrawlConfig : undefined;
  const counts = pages.flatMap((page) => page.issues || []).reduce((acc, issue) => {
    const severity = String(issue.severity || '').toLowerCase();
    if (severity === 'critical') acc.critical_count += 1;
    else if (severity === 'warning') acc.warning_count += 1;
    else if (severity === 'notice' || severity === 'info') acc.notice_count += 1;
    return acc;
  }, { critical_count: 0, warning_count: 0, notice_count: 0 });
  const status = terminal ? 'interrupted' : 'in-flight';
  return {
    id: runId, projectId, status, startedAt, updatedAt,
    completedAt: terminal?.type === 'crawl:completed' ? terminal.at : undefined,
    startUrl, config,
    result: {
      start_url: startUrl, pages, pages_crawled: pages.length,
      cancelled: terminal?.type === 'crawl:cancelled', timed_out: terminal?.type === 'crawl:timed_out',
      health_score: finite(terminalPayload.health_score), duration_ms: finite(terminalPayload.duration_ms) ?? eventDuration,
      critical_count: counts.critical_count, warning_count: counts.warning_count, notice_count: counts.notice_count,
      sitemap_urls: Array.isArray(terminalPayload.sitemap_urls) ? terminalPayload.sitemap_urls.filter((url): url is string => typeof url === 'string') : undefined,
    },
  };
};

export const buildInterruptedCrawlFromRecoveredRun = (run: RecoveredActiveCrawlRun, fallbackConfig?: CrawlConfig, fallbackLimit = 25): InterruptedCrawl => {
  const completed = new Set(run.result.pages.flatMap((page) => [page.url, page.final_url]).filter((url): url is string => Boolean(url)));
  const frontier = new Set(run.result.sitemap_urls || []);
  run.result.pages.forEach((page) => (page.links || []).forEach((link) => { if (link.target_url) frontier.add(link.target_url); }));
  completed.forEach((url) => frontier.delete(url));
  const configuredLimit = run.config?.maxPages;
  return {
    url: run.startUrl, limit: configuredLimit && configuredLimit > 0 ? configuredLimit : fallbackLimit,
    config: run.config || fallbackConfig, environment: run.environment || 'default', startedAt: run.startedAt,
    updatedAt: run.updatedAt, completedUrls: [...completed].slice(0, 20_000), frontierUrls: [...frontier].slice(0, 20_000),
    baseRunId: run.id, baseResult: run.result,
  };
};
