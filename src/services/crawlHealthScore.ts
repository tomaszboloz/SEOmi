import type { CrawledPageSummary, SiteCrawlResult } from '@/types';

export const CRAWL_SCORE_VERSION = 2;

const MAX_FINDING_TYPES = 3;

const findingType = (message: string): string => {
  const head = message.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase()).split(':', 1)[0].trim();
  return head.replace(/[0-9]+/g, '#') || '<empty>';
};

const affectedShares = (pages: CrawledPageSummary[], severity: string): number => {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const types = new Set((page.issues ?? []).filter((issue) => issue.severity === severity).map((issue) => findingType(issue.message)));
    for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.values()].sort((left, right) => right - left).slice(0, MAX_FINDING_TYPES)
    .reduce((total, count) => total + count / pages.length, 0);
};

/** Matches native scoring: three largest finding shares per severity, raw counts unchanged. */
export const crawlHealthScore = (pages: CrawledPageSummary[]): number => {
  if (!pages.length) return 50;
  const html = pages.filter((page) => page.request_error_kind == null && (page.content_type == null
    || ['text/html', 'application/xhtml+xml'].includes(page.content_type.split(';', 1)[0].trim().toLowerCase())));
  const evidenceCap = !html.length ? 50 : html.some((page) => page.body_truncated || page.semantic_content_partial) ? 90 : 100;
  const penalty = Math.min(80, Math.ceil(affectedShares(pages, 'Critical') / MAX_FINDING_TYPES * 60
    + affectedShares(pages, 'Warning') / MAX_FINDING_TYPES * 30));
  return Math.max(20, Math.min(evidenceCap, 100 - penalty));
};

/** Recompute legacy formulas only when every stored page is still available. */
export const comparableCrawlScore = (current: SiteCrawlResult, previous?: SiteCrawlResult): number | undefined => {
  const version = current.score_version;
  if (!previous || !Number.isSafeInteger(version) || !version || version < 1 || version > 65535) return undefined;
  if (!Number.isFinite(previous.health_score) || previous.health_score < 0 || previous.health_score > 100) return undefined;
  if (version === previous.score_version) return previous.health_score;
  if (version !== CRAWL_SCORE_VERSION || previous.storage_pages_truncated
    || previous.pages.length !== previous.pages_crawled
    || previous.pages.some(page => page.issues_count !== page.issues.length)) return undefined;
  return crawlHealthScore(previous.pages);
};
