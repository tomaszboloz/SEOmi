import type { CrawledPageSummary } from '@/types';

/**
 * Indexable Canonical vs Non-Indexable / Canonicalized (#132).
 * Only crawl evidence is used. No evidence means 'unknown', which is never excluded.
 */
export type IndexState = 'indexable' | 'noindex' | 'canonicalized' | 'error-status' | 'unknown';

export type GatePage = Pick<CrawledPageSummary, 'url' | 'http_status' | 'canonical' | 'canonical_targets' | 'meta_robots' | 'x_robots_tag' | 'robots_decision' | 'indexability_verdict' | 'final_url'>;

const NOINDEX = /(^|[\s,;])(noindex|none)([\s,;]|$)/i;

export const normalizeUrl = (value: string, base?: string): string | null => {
  try {
    const url = new URL(value, base);
    url.hash = '';
    const path = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
  } catch { return null; }
};

export const hostOf = (value: string, base?: string): string | null => {
  try { return new URL(value, base).host.toLowerCase(); } catch { return null; }
};

export const hasNoindex = (page: GatePage): boolean =>
  page.robots_decision?.indexability === 'noindex' || NOINDEX.test(page.meta_robots ?? '') || NOINDEX.test(page.x_robots_tag ?? '');

/** Canonical target different from the page itself (same host differences count too). */
export const canonicalTarget = (page: GatePage): string | null => {
  const raw = page.canonical_targets?.[0]?.url ?? page.canonical;
  if (!raw?.trim()) return null;
  const target = normalizeUrl(raw, page.final_url || page.url);
  const self = normalizeUrl(page.final_url || page.url);
  const own = normalizeUrl(page.url);
  return target && target !== self && target !== own ? target : null;
};

export const classifyIndexability = (page: GatePage): IndexState => {
  if (page.http_status >= 400) return 'error-status';
  if (hasNoindex(page)) return 'noindex';
  if (canonicalTarget(page)) return 'canonicalized';
  if (page.indexability_verdict?.status === 'blocked') return 'noindex';
  return page.indexability_verdict || page.robots_decision || page.http_status >= 200 ? 'indexable' : 'unknown';
};
