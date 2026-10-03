import {
  DEFAULT_AUDIT_TIMEOUT_MS,
  validatePublicScopeOptions,
  type PublicAuditOptions,
  type PublicAuditResult,
  type PublicCrawlResult,
} from './auditWorkflow.js';
import { LocalApiError } from './localApiHttp.js';

export type AuditRunner = (url: string, timeoutMs: number, options: PublicAuditOptions) => Promise<PublicAuditResult>;
export type CrawlRunner = (url: string, timeoutMs: number, maxPages: number, maxDepth: number, options: PublicAuditOptions) => Promise<PublicCrawlResult>;

export const executeApiPayload = async (
  body: unknown,
  urlPath: string,
  audit: AuditRunner,
  crawl: CrawlRunner,
): Promise<PublicAuditResult | PublicCrawlResult> => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new LocalApiError('Request body must be a JSON object.', 400);
  }
  const payload = body as Record<string, unknown>;
  const isCrawl = urlPath === '/v1/crawl';
  const urlField = isCrawl ? 'start_url' : 'url';
  if (typeof payload[urlField] !== 'string' || (payload[urlField] as string).trim().length === 0) {
    throw new LocalApiError(`Request body requires a non-empty ${urlField}.`, 400);
  }
  const timeoutMs = payload.timeout_ms === undefined ? DEFAULT_AUDIT_TIMEOUT_MS : payload.timeout_ms;
  if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
    throw new LocalApiError('timeout_ms must be an integer between 1000 and 30000.', 400);
  }
  if (payload.scope_host !== undefined && typeof payload.scope_host !== 'string') {
    throw new LocalApiError('scope_host must be a string.', 400);
  }
  if (payload.allow_subdomains !== undefined && typeof payload.allow_subdomains !== 'boolean') {
    throw new LocalApiError('allow_subdomains must be a boolean.', 400);
  }
  if (payload.scope_path !== undefined && typeof payload.scope_path !== 'string') {
    throw new LocalApiError('scope_path must be a string.', 400);
  }
  for (const field of ['include_patterns', 'exclude_patterns']) {
    if (payload[field] !== undefined && (!Array.isArray(payload[field]) || (payload[field] as unknown[]).some((val) => typeof val !== 'string'))) {
      throw new LocalApiError(`${field} must be an array of strings.`, 400);
    }
  }
  const scope: PublicAuditOptions = {
    scopeHost: payload.scope_host as string | undefined,
    allowSubdomains: payload.allow_subdomains as boolean | undefined,
  };
  if (payload.scope_path !== undefined) scope.scopePath = payload.scope_path as string;
  if (payload.include_patterns !== undefined) scope.includePatterns = payload.include_patterns as string[];
  if (payload.exclude_patterns !== undefined) scope.excludePatterns = payload.exclude_patterns as string[];
  try {
    validatePublicScopeOptions(scope);
  } catch (error) {
    throw new LocalApiError(error instanceof Error ? error.message : 'Invalid scope options.', 400);
  }
  if (isCrawl) {
    const maxPages = payload.max_pages === undefined ? 25 : payload.max_pages;
    const maxDepth = payload.max_depth === undefined ? 3 : payload.max_depth;
    if (typeof maxPages !== 'number' || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) {
      throw new LocalApiError('max_pages must be an integer between 1 and 100.', 400);
    }
    if (typeof maxDepth !== 'number' || !Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 10) {
      throw new LocalApiError('max_depth must be an integer between 0 and 10.', 400);
    }
    return await crawl(payload[urlField] as string, timeoutMs, maxPages, maxDepth, scope);
  }
  return await audit(payload[urlField] as string, timeoutMs, scope);
};
