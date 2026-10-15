import type { SerpHit } from './types';

export const hostOf = (value: string): string => {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

const originOf = (url: string, domain: string): string => {
  try {
    return `${new URL(url).origin}/`;
  } catch {
    return `https://${domain}/`;
  }
};

export interface DomainCandidate { domain: string; startUrl: string; appearances: number; bestRank: number }

/**
 * Collapses SERP hits of several queries into distinct competitor domains. The own site is
 * excluded; ordering is appearances desc, best rank asc, then domain for determinism.
 */
export const pickCompetitors = (perQuery: SerpHit[][], ownUrl: string, limit: number): DomainCandidate[] => {
  const own = hostOf(ownUrl);
  const found = new Map<string, DomainCandidate>();
  perQuery.forEach((hits) => {
    const seen = new Set<string>();
    hits.forEach((hit) => {
      const domain = hostOf(hit.domain || hit.url);
      if (!domain || domain === own || seen.has(domain)) return;
      seen.add(domain);
      const current = found.get(domain);
      if (current) {
        current.appearances += 1;
        current.bestRank = Math.min(current.bestRank, hit.rank);
      } else {
        found.set(domain, { domain, startUrl: originOf(hit.url, domain), appearances: 1, bestRank: hit.rank });
      }
    });
  });
  return [...found.values()]
    .sort((a, b) => b.appearances - a.appearances || a.bestRank - b.bestRank || Number(a.domain > b.domain) - Number(a.domain < b.domain))
    .slice(0, Math.max(0, limit));
};
