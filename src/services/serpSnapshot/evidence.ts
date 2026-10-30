import type { SerpAvailability, SerpSnapshot } from '@/services/serpImport/contracts';

/**
 * Shared SERP evidence (#85 GEM-85-05, #86 GEM-86-04/05, #106 item 1). Every module that reads search
 * results keeps the full provenance next to the hits instead of the bare `{ source, hits }` shortcut:
 * provider, query, market, time, availability and the real number of results (K).
 */
export type SerpProviderKind = 'dataforseo-live' | 'bing-rss' | 'csv-import' | 'json-import';

export interface SerpEvidence {
  query: string;
  providerKind: SerpProviderKind;
  provider: string | null;
  countryCode: string | null;
  languageCode: string | null;
  /** Unknown stays null. */
  retrievedAt: string | null;
  availability: SerpAvailability;
  reason: string | null;
  /** Depth asked from the provider; null when the provider has no such parameter. */
  requestedDepth: number | null;
  /** Organic results really returned after de-duplication. */
  actualK: number;
}

export interface SerpEvidenceSummary {
  providers: SerpProviderKind[];
  /** Worst availability across all queries. */
  availability: SerpAvailability;
  /** True only when every query came from complete evidence; Bing RSS never qualifies. */
  fullScoreEligible: boolean;
  minK: number;
  maxK: number;
  queries: number;
}

const ORDER: SerpAvailability[] = ['complete', 'partial', 'blocked', 'missing'];
export const TOP10 = 10;

/** Evidence from an already normalized snapshot (free Bing RSS, CSV/JSON import). */
export const evidenceFromSnapshot = (query: string, snapshot: SerpSnapshot | undefined, kind: SerpProviderKind): SerpEvidence => ({
  query,
  providerKind: kind,
  provider: snapshot?.source.provider ?? null,
  countryCode: snapshot?.source.countryCode ?? null,
  languageCode: snapshot?.source.languageCode ?? null,
  retrievedAt: snapshot?.source.retrievedAt ?? snapshot?.source.capturedAt ?? null,
  availability: snapshot ? (snapshot.rows.length ? snapshot.source.availability : 'missing') : 'missing',
  reason: snapshot?.source.reason ?? null,
  requestedDepth: null,
  actualK: snapshot ? new Set(snapshot.rows.map((row) => row.url)).size : 0,
});

/**
 * Evidence for live DataForSEO organic results. Fewer than ten distinct organic URLs is `partial`:
 * three results never pass for a TOP 10.
 */
export const evidenceFromLive = (
  query: string, urls: string[], market: { countryCode: string | null; languageCode: string | null; requestedDepth: number | null; retrievedAt: string },
): SerpEvidence => {
  const actualK = new Set(urls.filter(Boolean)).size;
  return {
    query, providerKind: 'dataforseo-live', provider: 'DataForSEO', countryCode: market.countryCode, languageCode: market.languageCode,
    retrievedAt: market.retrievedAt, availability: actualK === 0 ? 'missing' : actualK < TOP10 ? 'partial' : 'complete',
    reason: actualK === 0 ? 'no-organic-results' : actualK < TOP10 ? 'fewer-than-top10' : null,
    requestedDepth: market.requestedDepth, actualK,
  };
};

export const summarizeSerpEvidence = (list: SerpEvidence[]): SerpEvidenceSummary | null => {
  if (!list.length) return null;
  const availability = list.reduce<SerpAvailability>((worst, item) => (ORDER.indexOf(item.availability) > ORDER.indexOf(worst) ? item.availability : worst), 'complete');
  const ks = list.map((item) => item.actualK);
  return {
    providers: [...new Set(list.map((item) => item.providerKind))].sort(),
    availability,
    fullScoreEligible: list.every((item) => item.availability === 'complete' && item.providerKind !== 'bing-rss'),
    minK: Math.min(...ks), maxK: Math.max(...ks), queries: list.length,
  };
};
