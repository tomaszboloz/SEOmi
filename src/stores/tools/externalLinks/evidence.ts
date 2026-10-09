import type { CrawlRunRecord, ExternalLinkCheckBatchResult, SiteCrawlResult } from '@/types';
import i18n from '@/i18n';
import { normalizeCrawlLinkUrl } from '../crawlPersistence';
import { crawlHealthScore, CRAWL_SCORE_VERSION } from '@/services/crawlHealthScore';

export const collectExternalLinkTargets = (run: CrawlRunRecord, force: boolean): string[] =>
  [...new Set(run.result.pages.flatMap(page => page.links
    .filter(link => !link.is_internal && (force || !link.target_checked_at))
    .map(link => normalizeCrawlLinkUrl(link.target_url))))];

export const applyExternalLinkEvidence = (result: SiteCrawlResult, batch: ExternalLinkCheckBatchResult, force: boolean): SiteCrawlResult => {
  const byUrl = new Map(batch.results.map((item) => [normalizeCrawlLinkUrl(item.url), item]));
  const checkedAtFallback = new Date().toISOString();
  const pages = result.pages.map((page) => {
    const links = page.links.map((link) => {
      if (link.is_internal || (!force && link.target_checked_at)) return link;
      const check = byUrl.get(normalizeCrawlLinkUrl(link.target_url));
      if (!check) return link;
      return {
        ...link,
        target_http_status: check.httpStatus,
        target_response_time_ms: check.responseTimeMs,
        target_redirect_url: check.redirectUrl,
        target_request_error_kind: check.requestErrorKind,
        target_checked_at: check.checkedAt || checkedAtFallback,
      };
    });
    const existing = page.issues.filter((issue) => issue.code !== 'external-link-check');
    const failedTargets = new Set(links.filter((link) => !link.is_internal && (
      (link.target_http_status !== undefined && link.target_http_status >= 400)
      || ['dns', 'timeout', 'tls', 'connect', 'network'].includes(link.target_request_error_kind || '')
    )).map((link) => normalizeCrawlLinkUrl(link.target_url)));
    if (failedTargets.size) existing.push({
      severity: 'Warning',
      code: 'external-link-check',
      message: i18n.t('crawl.ui.externalLinkIssue', { count: failedTargets.size }),
    });
    return { ...page, links, issues: existing, issues_count: existing.length };
  });
  const criticalCount = pages.reduce((count, page) => count + page.issues.filter((issue) => issue.severity === 'Critical').length, 0);
  const warningCount = pages.reduce((count, page) => count + page.issues.filter((issue) => issue.severity === 'Warning').length, 0);
  const noticeCount = pages.reduce((count, page) => count + page.issues.filter((issue) => issue.severity === 'Info').length, 0);
  const healthScore = crawlHealthScore(pages);
  const updated = { ...result, pages, critical_count: criticalCount, warning_count: warningCount, notice_count: noticeCount, health_score: healthScore, score_version: CRAWL_SCORE_VERSION };
  return updated;
};
