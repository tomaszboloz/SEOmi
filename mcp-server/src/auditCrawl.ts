import { validatePublicTarget } from './httpSafety.js';
import type {
  PublicAuditOptions,
  PublicAuditRunner,
  PublicCrawlError,
  PublicCrawlPage,
  PublicCrawlResult,
  PublicTargetValidator,
} from './auditTypes.js';
import {
  assertScope,
  isUrlWithinScope,
  normalizeCrawlUrl,
  normalizePatterns,
  normalizeScopePath,
  validatePublicScopeOptions,
} from './auditScope.js';
import { auditPublicUrl } from './auditRunner.js';

const MAX_CRAWL_ERRORS = 50;
const CRAWL_CONCURRENCY = 4;

export const crawlPublicSite = async (
  value: string,
  timeoutMs: number,
  maxPages: number,
  maxDepth: number,
  options: PublicAuditOptions = {},
  runner: PublicAuditRunner = auditPublicUrl,
  validateStart: PublicTargetValidator = validatePublicTarget,
): Promise<PublicCrawlResult> => {
  validatePublicScopeOptions(options);
  const start = await validateStart(value);
  const scopeHost = (options.scopeHost || start.url.hostname).trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  const allowSubdomains = Boolean(options.allowSubdomains);
  const scopeOptions = {
    ...options,
    scopeHost,
    allowSubdomains,
    scopePath: normalizeScopePath(options.scopePath),
    includePatterns: normalizePatterns(options.includePatterns),
    excludePatterns: normalizePatterns(options.excludePatterns),
  };
  assertScope(start.url, scopeOptions);
  const boundedPages = Math.min(Math.max(Math.trunc(maxPages), 1), 100);
  const boundedDepth = Math.min(Math.max(Math.trunc(maxDepth), 0), 10);
  const queue: Array<{ url: string; depth: number }> = [{ url: normalizeCrawlUrl(start.url.toString()), depth: 0 }];
  const queued = new Set(queue.map((item) => item.url));
  const pages: PublicCrawlPage[] = [];
  const errors: PublicCrawlError[] = [];
  let discoveredUrls = 1;
  let truncated = false;

  while (queue.length && pages.length < boundedPages) {
    const batch = queue.splice(0, Math.min(CRAWL_CONCURRENCY, boundedPages - pages.length));
    const settled = await Promise.allSettled(batch.map((item) => runner(item.url, timeoutMs, scopeOptions)));
    // Results are applied in queue order, so the outcome never depends on network timing.
    const audited: Array<{ depth: number; audit: PublicCrawlPage['audit'] }> = [];
    settled.forEach((outcome, index) => {
      const item = batch[index];
      if (outcome.status === 'fulfilled') {
        pages.push({ depth: item.depth, audit: outcome.value });
        audited.push({ depth: item.depth, audit: outcome.value });
        return;
      }
      const reason = outcome.reason;
      errors.push({ url: item.url, depth: item.depth, error: reason instanceof Error ? reason.message : String(reason) });
    });
    for (const { depth, audit } of audited) {
      if (depth >= boundedDepth) continue;
      for (const candidate of audit.discovered_links) {
        if (queued.has(candidate)) continue;
        let parsed: URL;
        try { parsed = new URL(candidate); } catch { continue; }
        if (!isUrlWithinScope(parsed, scopeOptions)) continue;
        queued.add(candidate);
        discoveredUrls += 1;
        if (queue.length + pages.length >= boundedPages) {
          truncated = true;
          continue;
        }
        queue.push({ url: candidate, depth: depth + 1 });
      }
      if (audit.discovered_links_truncated) truncated = true;
    }
  }
  if (queue.length) truncated = true;
  return {
    requested_url: value,
    scope_host: scopeHost,
    allow_subdomains: allowSubdomains,
    max_pages: boundedPages,
    max_depth: boundedDepth,
    scope_path: scopeOptions.scopePath || null,
    include_patterns: scopeOptions.includePatterns,
    exclude_patterns: scopeOptions.excludePatterns,
    pages,
    errors: errors.slice(0, MAX_CRAWL_ERRORS),
    discovered_urls: discoveredUrls,
    truncated,
  };
};
