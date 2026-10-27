import type { SiteCrawlResult } from '@/types';
import type { RecoveredActiveCrawlResult } from '@/services/crawlPersistence/contracts';
import type { InterruptedCrawl } from '../contracts';
import { crawlHealthScore, CRAWL_SCORE_VERSION } from '@/services/crawlHealthScore';

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

export const mergeCrawlResults = (
  base: SiteCrawlResult | RecoveredActiveCrawlResult,
  fresh: SiteCrawlResult,
): SiteCrawlResult => {
  const pagesByUrl = new Map<string, SiteCrawlResult['pages'][number]>();
  for (const page of base.pages) pagesByUrl.set(checkpointUrl(page.final_url || page.url), page);
  for (const page of fresh.pages) pagesByUrl.set(checkpointUrl(page.final_url || page.url), page);
  const pages = [...pagesByUrl.values()];
  const criticalCount = pages.flatMap((page) => page.issues || []).filter((issue) => issue.severity === 'Critical').length;
  const warningCount = pages.flatMap((page) => page.issues || []).filter((issue) => issue.severity === 'Warning').length;
  const noticeCount = pages.flatMap((page) => page.issues || []).filter((issue) => issue.severity === 'Info').length;
  const healthScore = crawlHealthScore(pages);
  const sitemapUrls = [...new Set([...(base.sitemap_urls || []), ...(fresh.sitemap_urls || [])])];
  const rejected = new Map<string, { url: string; reason: string }>();
  const baseRejected = 'rejected_urls' in base && Array.isArray(base.rejected_urls) ? base.rejected_urls : [];
  for (const item of [...baseRejected, ...(fresh.rejected_urls || [])]) rejected.set(`${item.url}\n${item.reason}`, item);
  const resources = new Map<string, NonNullable<SiteCrawlResult['resources']>[number]>();
  const baseResources = 'resources' in base && Array.isArray(base.resources) ? base.resources : [];
  for (const resource of [...baseResources, ...(fresh.resources || [])]) resources.set(checkpointUrl(resource.url), resource);
  const baseDuration = typeof base.duration_ms === 'number' && Number.isFinite(base.duration_ms) ? base.duration_ms : 0;
  const freshDuration = typeof fresh.duration_ms === 'number' && Number.isFinite(fresh.duration_ms) ? fresh.duration_ms : 0;
  const baseLimit = 'resource_limit_reached' in base ? Boolean(base.resource_limit_reached) : false;
  return {
    ...fresh,
    start_url: base.start_url || fresh.start_url,
    pages_crawled: pages.length,
    health_score: healthScore,
    score_version: CRAWL_SCORE_VERSION,
    critical_count: criticalCount,
    warning_count: warningCount,
    notice_count: noticeCount,
    pages,
    duration_ms: baseDuration + freshDuration,
    sitemap_urls_discovered: sitemapUrls.length,
    sitemap_urls: sitemapUrls,
    rejected_urls: [...rejected.values()],
    resources: [...resources.values()],
    resource_limit_reached: Boolean(baseLimit || fresh.resource_limit_reached),
  };
};
