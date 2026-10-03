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
    const current = queue.shift()!;
    try {
      const audit = await runner(current.url, timeoutMs, scopeOptions);
      pages.push({ depth: current.depth, audit });
      if (current.depth >= boundedDepth) continue;
      for (const candidate of audit.discovered_links) {
        if (queued.has(candidate)) continue;
        let parsed: URL;
        try { parsed = new URL(candidate); } catch { continue; }
        if (!isUrlWithinScope(parsed, scopeOptions)) continue;
        queued.add(candidate);
        discoveredUrls += 1;
        if (queue.length + pages.length >= boundedPages) {
          truncated = true;
          break;
        }
        queue.push({ url: candidate, depth: current.depth + 1 });
      }
      if (audit.discovered_links_truncated) truncated = true;
    } catch (error) {
      errors.push({ url: current.url, depth: current.depth, error: error instanceof Error ? error.message : String(error) });
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
    include_patterns: scopeOptions.includePatterns || [],
    exclude_patterns: scopeOptions.excludePatterns || [],
    pages,
    errors: errors.slice(0, MAX_CRAWL_ERRORS),
    discovered_urls: discoveredUrls,
    truncated,
  };
};
