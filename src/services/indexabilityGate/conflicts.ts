import { canonicalTarget, classifyIndexability, hostOf, normalizeUrl, type GatePage } from './classify';

export type ConflictCode = 'pillar-noindex' | 'inlinked-foreign-canonical' | 'noindex-with-traffic' | 'sitemap-noindex';

export interface IndexConflict { code: ConflictCode; url: string; detail: Record<string, number | string> }

export interface ConflictInput {
  pages: readonly GatePage[];
  /** URLs the caller treats as pillars (e.g. hubs from SFS). */
  pillarUrls?: readonly string[];
  /** Inlink counts per URL, from the crawl link graph. Absent means unknown. */
  inlinkCounts?: ReadonlyMap<string, number>;
  /** Real GSC clicks / referring domains per URL. Absent entries are unknown, not zero. */
  clicks?: ReadonlyMap<string, number>;
  referringDomains?: ReadonlyMap<string, number>;
  sitemapUrls?: readonly string[];
  inlinkThreshold?: number;
}

export const DEFAULT_INLINK_THRESHOLD = 50;

const key = (url: string): string => normalizeUrl(url) ?? url;

export const detectConflicts = (input: ConflictInput): IndexConflict[] => {
  const out: IndexConflict[] = [];
  const pillars = new Set((input.pillarUrls ?? []).map(key));
  const sitemap = new Set((input.sitemapUrls ?? []).map(key));
  const threshold = input.inlinkThreshold ?? DEFAULT_INLINK_THRESHOLD;
  input.pages.forEach((page) => {
    const id = key(page.url);
    const state = classifyIndexability(page);
    if (state === 'noindex') {
      if (pillars.has(id)) out.push({ code: 'pillar-noindex', url: page.url, detail: {} });
      const clicks = input.clicks?.get(id) ?? 0;
      const domains = input.referringDomains?.get(id) ?? 0;
      if (clicks > 0 || domains > 0) out.push({ code: 'noindex-with-traffic', url: page.url, detail: { clicks, referringDomains: domains } });
      if (sitemap.has(id)) out.push({ code: 'sitemap-noindex', url: page.url, detail: {} });
    }
    const target = state === 'canonicalized' ? canonicalTarget(page) : null;
    const inlinks = input.inlinkCounts?.get(id);
    if (target && inlinks !== undefined && inlinks >= threshold && hostOf(target) !== hostOf(page.url)) {
      out.push({ code: 'inlinked-foreign-canonical', url: page.url, detail: { inlinks, target } });
    }
  });
  return out;
};
