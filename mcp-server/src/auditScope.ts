import type { PublicAuditOptions } from './auditTypes.js';

const MAX_SCOPE_PATTERNS = 20;
const MAX_SCOPE_PATTERN_LENGTH = 200;

export const normalizeCrawlUrl = (value: string): string => {
  const url = new URL(value);
  url.hash = '';
  return url.toString();
};

export const normalizeScopePath = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() || '';
  if (!trimmed) return undefined;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return path.length > 1 ? path.replace(/\/+$/u, '') : '/';
};

export const normalizePatterns = (values: string[] | undefined): string[] => [...new Set((values || [])
  .map((value) => value.trim())
  .filter(Boolean))].slice(0, MAX_SCOPE_PATTERNS);

export const validatePublicScopeOptions = (options: PublicAuditOptions): void => {
  if (options.scopePath !== undefined && (typeof options.scopePath !== 'string' || options.scopePath.length > 2048 || /[\u0000-\u001f]/u.test(options.scopePath))) {
    throw new Error('scope_path must be a safe path up to 2048 characters.');
  }
  for (const [name, values] of [['includePatterns', options.includePatterns], ['excludePatterns', options.excludePatterns] as const]) {
    if (values !== undefined && (!Array.isArray(values) || values.length > MAX_SCOPE_PATTERNS || values.some((value) => typeof value !== 'string' || value.length > MAX_SCOPE_PATTERN_LENGTH || /[\u0000-\u001f]/u.test(value)))) {
      throw new Error(`${name} must contain at most ${MAX_SCOPE_PATTERNS} safe patterns of ${MAX_SCOPE_PATTERN_LENGTH} characters.`);
    }
  }
};

export const globMatchesPath = (pathname: string, pattern: string): boolean => {
  const normalized = pattern.startsWith('/') ? pattern : `/${pattern}`;
  const expression = normalized.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/gu, '\\$&')).join('.*');
  try { return new RegExp(`^${expression}$`, 'u').test(pathname); } catch { return false; }
};

export const isUrlWithinScope = (url: URL, options: PublicAuditOptions): boolean => {
  if (options.scopePath) {
    const scopePath = normalizeScopePath(options.scopePath);
    if (scopePath && !(url.pathname === scopePath || url.pathname.startsWith(`${scopePath.replace(/\/$/u, '')}/`))) return false;
  }
  const includePatterns = normalizePatterns(options.includePatterns);
  const excludePatterns = normalizePatterns(options.excludePatterns);
  if (includePatterns.length && !includePatterns.some((pattern) => globMatchesPath(url.pathname, pattern))) return false;
  if (excludePatterns.some((pattern) => globMatchesPath(url.pathname, pattern))) return false;
  if (!options.scopeHost) return true;
  const scopeHost = options.scopeHost.trim().toLocaleLowerCase().replace(/^\.+|\.+$/g, '');
  const hostname = url.hostname.toLocaleLowerCase().replace(/^\.+|\.+$/g, '');
  return Boolean(scopeHost) && (hostname === scopeHost || Boolean(options.allowSubdomains && hostname.endsWith(`.${scopeHost}`)));
};

export const assertScope = (url: URL, options: PublicAuditOptions): void => {
  if (!isUrlWithinScope(url, options)) {
    const scopeHost = options.scopeHost?.trim().replace(/^\.+|\.+$/g, '') || 'invalid';
    throw new Error(`URL is outside the requested scope host (${scopeHost}).`);
  }
};
