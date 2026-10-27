import { normalizeUrl } from './pageType';
import type { Prepared } from './evaluate';
import type { CoreAnchors } from './types';

/** Upper bounds on user input: anchors are a short list of key offer pages, not a crawl. */
export const MAX_ANCHORS = 20;
export const MAX_ANCHOR_URL_LENGTH = 2048;

export interface AnchorResolution extends CoreAnchors {
  /** Per-term TF-IDF mass of the anchor pages, each page L1-normalised so long pages do not dominate. */
  mass: Map<string, number>;
}

const isHttp = (url: string): boolean => /^https?:\/\//i.test(url);

/** URLs a crawled page answers for: requested and post-redirect first, then its declared canonical. */
const ownUrls = (item: Prepared): string[] => [item.page.url, item.page.final_url].filter(isHttp).map(normalizeUrl);
const canonicalUrls = (item: Prepared): string[] => [item.page.canonical ?? ''].filter(isHttp).map(normalizeUrl);

/**
 * Resolves the home page plus explicit anchors against scored pages. Unknown, unscored
 * (noindex, error, empty) or malformed URLs are reported as missing, never guessed.
 * Returns undefined when no anchors were requested, so auto mode stays untouched.
 */
export const resolveAnchors = (
  live: Prepared[], vectors: Map<string, number>[], startUrl: string, anchorUrls: string[] | undefined,
): AnchorResolution | undefined => {
  const requested = (anchorUrls ?? []).map((url) => url.trim())
    .filter((url) => url && url.length <= MAX_ANCHOR_URL_LENGTH).slice(0, MAX_ANCHORS);
  if (!requested.length) return undefined;
  const wanted = [...new Set([startUrl, ...requested].map(normalizeUrl))];
  const index = new Map<string, number>();
  // A page's own URL beats another page's canonical claim on it.
  [ownUrls, canonicalUrls].forEach((aliases) => live.forEach((item, i) => aliases(item).forEach((alias) => {
    if (!index.has(alias)) index.set(alias, i);
  })));
  const sources: string[] = [];
  const missing: string[] = [];
  const used = new Set<number>();
  const mass = new Map<string, number>();
  wanted.forEach((url) => {
    const i = isHttp(url) ? index.get(url) : undefined;
    if (i === undefined) { missing.push(url); return; }
    sources.push(url);
    if (used.has(i)) return;
    used.add(i);
    const total = [...vectors[i].values()].reduce((sum, value) => sum + value, 0);
    if (total > 0) vectors[i].forEach((value, key) => mass.set(key, (mass.get(key) ?? 0) + value / total));
  });
  return { sources, missing, applied: false, mass };
};
