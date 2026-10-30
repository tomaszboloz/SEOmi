import type { SerpEvidence } from './evidence';

/**
 * SERP normalization (#86 GEM-86-06, T03). The same document can come back as `http://www.a.pl/x/`,
 * `https://a.pl/x?utm_source=…` and `https://a.pl/x#top`; counting those as three results inflates K and
 * repeats a competitor. Ranks are re-numbered after de-duplication and the best (lowest) rank wins.
 */
const TRACKING = /^(?:utm_[a-z]+|gclid|fbclid|msclkid|yclid|mc_cid|mc_eid|ref|srsltid)$/iu;

/** Canonical comparison key: lower-case host without `www.`, no scheme, fragment, tracking params or trailing slash. */
export const serpUrlKey = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./u, '');
    const params = [...url.searchParams].filter(([key]) => !TRACKING.test(key)).sort(([a], [b]) => a.localeCompare(b));
    const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
    const path = url.pathname.replace(/\/+$/u, '') || '';
    const port = url.port && url.port !== '80' && url.port !== '443' ? `:${url.port}` : '';
    return `${host}${port}${path}${query}`;
  } catch {
    return null;
  }
};

export interface RankedUrl { url: string; rank: number }

export interface DedupedSerp {
  rows: RankedUrl[];
  /** Rows dropped as duplicates of a better-ranked URL. */
  duplicates: number;
  /** Rows dropped because the URL or rank was unusable. */
  invalid: number;
}

export const dedupeSerpRows = (rows: readonly RankedUrl[]): DedupedSerp => {
  const best = new Map<string, RankedUrl>();
  let invalid = 0;
  let duplicates = 0;
  rows.forEach((row) => {
    const key = serpUrlKey(row.url);
    if (!key || !Number.isInteger(row.rank) || row.rank < 1) { invalid += 1; return; }
    const seen = best.get(key);
    if (seen) duplicates += 1;
    if (!seen || row.rank < seen.rank) best.set(key, row);
  });
  const ordered = [...best.values()].sort((a, b) => a.rank - b.rank || a.url.localeCompare(b.url));
  return { rows: ordered.map((row, index) => ({ url: row.url, rank: index + 1 })), duplicates, invalid };
};

export type MarketMismatch = 'country' | 'language' | 'unknown-country' | 'unknown-language';

/**
 * Compares a snapshot's market with the market a module needs. Unknown metadata is reported, not assumed
 * to match: a module may accept it as partial, but it is never silently treated as the right market.
 */
export const marketMismatch = (evidence: Pick<SerpEvidence, 'countryCode' | 'languageCode'>, expected: { countryCode: string; languageCode: string }): MarketMismatch[] => {
  const issues: MarketMismatch[] = [];
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (evidence.countryCode === null) issues.push('unknown-country');
  else if (!same(evidence.countryCode, expected.countryCode)) issues.push('country');
  if (evidence.languageCode === null) issues.push('unknown-language');
  else if (!same(evidence.languageCode.split(/[-_]/u)[0], expected.languageCode.split(/[-_]/u)[0])) issues.push('language');
  return issues;
};
