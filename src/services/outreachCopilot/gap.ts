import type { BacklinkGapOpportunity } from '@/types';

export interface OutreachTarget {
  domain: string;
  /** Competitors (of the TOP3 set) that this domain links to. */
  linkingCompetitors: string[];
  /** Share of the competitor set that earned a link from this domain (0 to 1). */
  relevance: number;
  /** Mean rank of the competitor links, scaled 0 to 1; 0 when the source gave no rank. */
  authority: number;
  priority: number;
}

export interface GapOptions {
  /** Domains with a spam score above this are dropped. Unknown scores stay. */
  maxSpamScore?: number;
  /** Rank scale of the data source (DataForSEO and Moz use 0 to 100). */
  rankScale?: number;
  /** Optional ordered TOP3 set; links outside it are ignored. */
  topCompetitors?: string[];
}

export const normalizeDomain = (value: string): string =>
  value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];

/**
 * Referring domains that link to at least one competitor and not to the own site.
 * Duplicates (www, case, URL form) collapse into one row; highest priority first.
 * Input is real backlink-gap data; an empty input yields an empty list.
 */
export const outreachTargets = (
  opportunities: BacklinkGapOpportunity[],
  competitorCount: number,
  options: GapOptions = {},
): OutreachTarget[] => {
  const { maxSpamScore = 60, rankScale = 100 } = options;
  const topCompetitors = options.topCompetitors
    ? [...new Set(options.topCompetitors.slice(0, 3).map(normalizeDomain).filter(Boolean))]
    : null;
  const denominator = topCompetitors ? topCompetitors.length : competitorCount;
  const allowed = topCompetitors ? new Set(topCompetitors) : null;
  const byDomain = new Map<string, OutreachTarget>();
  for (const row of opportunities) {
    const domain = normalizeDomain(row.referring_domain);
    if (!domain || row.target_backlinks > 0) continue;
    if (row.max_competitor_spam_score !== null && row.max_competitor_spam_score > maxSpamScore) continue;
    const linking = row.competitor_backlinks.filter((link) => {
      const competitor = normalizeDomain(link.domain);
      return link.backlinks > 0 && !!competitor && (!allowed || allowed.has(competitor));
    });
    if (linking.length === 0) continue;
    const ranks = linking.flatMap((link) => (
      link.rank !== null && Number.isFinite(link.rank) && rankScale > 0
        ? [Math.min(1, Math.max(0, link.rank / rankScale))]
        : []
    ));
    const authority = ranks.length ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length : 0;
    const previous = byDomain.get(domain);
    const competitors = [...new Set([...(previous?.linkingCompetitors ?? []), ...linking.map((link) => normalizeDomain(link.domain))])];
    const relevance = denominator > 0 ? Math.min(1, competitors.length / denominator) : 0;
    const merged = Math.max(authority, previous?.authority ?? 0);
    byDomain.set(domain, { domain, linkingCompetitors: competitors, relevance, authority: merged, priority: relevance * merged });
  }
  return [...byDomain.values()].sort((a, b) => b.priority - a.priority || b.relevance - a.relevance || a.domain.localeCompare(b.domain));
};
