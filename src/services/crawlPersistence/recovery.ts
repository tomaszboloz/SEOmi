import type { CrawlConfig } from '@/types';
import type { InterruptedCrawl } from '@/stores/tools/contracts';
import type { AnyCrawlRun, RecoveredActiveCrawlRun } from './contracts';

export const buildInterruptedCrawlFromRecoveredRun = (
  run: RecoveredActiveCrawlRun,
  fallbackConfig?: CrawlConfig,
  fallbackLimit?: number,
): InterruptedCrawl => {
  const completed = new Set(run.result.pages.flatMap((p) => [p.url, p.final_url]).filter((u): u is string => typeof u === 'string' && Boolean(u)));
  const frontier = new Set<string>(run.result.sitemap_urls || []);
  for (const page of run.result.pages) {
    for (const link of page.links || []) if (link.target_url) frontier.add(link.target_url);
  }
  for (const url of completed) frontier.delete(url);
  return {
    url: run.startUrl,
    limit: (run.config?.maxPages ?? fallbackLimit) as any,
    config: (run.config ?? fallbackConfig) as any,
    environment: (run.environment || 'default') as any,
    startedAt: run.startedAt as any,
    updatedAt: run.startedAt as any,
    completedUrls: [...completed],
    frontierUrls: [...frontier],
    baseRunId: run.id,
    baseResult: run.result,
  };
};

export const reconstructInFlightRun = (
  runId: string,
  projectId: string,
  events: ReadonlyArray<{ type: string; at?: string; payload?: unknown }>,
): AnyCrawlRun => {
  const startEv = events.find((e) => e.type === 'crawl:started');
  const startPayload = startEv?.payload as Record<string, unknown> | undefined;
  const pages = events.filter((e) => e.type === 'crawl:page').map((e) => e.payload as any);
  const completedEv = events.find((e) => e.type === 'crawl:completed');
  const completedPayload = completedEv?.payload as Record<string, unknown> | undefined;
  const startUrl = (startPayload?.startUrl as string) ?? (startPayload?.url as string) ?? '';
  const lastEv = events.at(-1);
  const computedDuration = lastEv?.at && startEv?.at
    ? Math.max(0, new Date(lastEv.at).getTime() - new Date(startEv.at).getTime())
    : undefined;
  let critical_count = 0, warning_count = 0, notice_count = 0;
  for (const p of pages) {
    for (const iss of p.issues ?? []) {
      if (iss.severity === 'critical') critical_count++;
      else if (iss.severity === 'warning') warning_count++;
      else if (iss.severity === 'notice') notice_count++;
    }
  }
  const isCancelled = events.some((e) => e.type === 'crawl:cancelled');
  const isTimedOut = events.some((e) => e.type === 'crawl:timed_out');
  const baseResult = {
    start_url: startUrl,
    pages_crawled: pages.length,
    critical_count,
    warning_count,
    notice_count,
    pages,
    duration_ms: (completedPayload?.duration_ms as number | undefined) ?? computedDuration,
    cancelled: isCancelled,
    timed_out: isTimedOut,
    robots_txt_status: 'unknown',
    sitemap_status: 'unknown',
    sitemap_urls: [],
  };
  return {
    id: runId,
    projectId,
    startedAt: startEv?.at,
    completedAt: completedEv?.at,
    startUrl,
    config: startPayload?.config as CrawlConfig | undefined,
    status: isCancelled ? 'interrupted' : completedEv ? 'interrupted' : 'in-flight',
    result: {
      ...baseResult,
      health_score: typeof completedPayload?.health_score === 'number' ? completedPayload.health_score : undefined,
      robots_blocked_count: typeof completedPayload?.robots_blocked_count === 'number' ? completedPayload.robots_blocked_count : undefined,
      sitemap_urls_discovered: typeof completedPayload?.sitemap_urls_discovered === 'number' ? completedPayload.sitemap_urls_discovered : undefined,
    },
  };
};
