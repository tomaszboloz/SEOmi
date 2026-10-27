import type { BenchmarkDeps, SerpHit } from '@/services/siteFocusBenchmark';
import { hostOf } from '@/services/siteFocusBenchmark';
import type { BaselineDoc } from './types';

export const DEFAULT_QUERIES = 2;
export const DEFAULT_DOCS = 8;
export const DEFAULT_CONCURRENCY = 2;

export type CollectProgress =
  | { phase: 'serp'; done: number; total: number }
  | { phase: 'fetch'; done: number; total: number; url: string };

export interface CollectInput {
  /** Own start URL: its domain is never part of the consensus. */
  startUrl: string;
  queries: string[];
  maxDocs?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: CollectProgress) => void;
}

export type UnavailableReason = 'no-serp-source' | 'no-queries' | 'serp-failed' | 'no-documents';

export type CollectOutcome =
  | { status: 'unavailable'; reason: UnavailableReason; error?: string }
  | { status: 'cancelled' }
  | { status: 'ok'; docs: BaselineDoc[]; queries: string[]; source: string; failed: number };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Distinct ranking pages (one per domain), best rank first, own domain excluded. */
export const pickDocuments = (perQuery: SerpHit[][], ownUrl: string, limit: number): SerpHit[] => {
  const own = hostOf(ownUrl);
  const seen = new Set<string>();
  const out: SerpHit[] = [];
  const depth = Math.max(0, ...perQuery.map((hits) => hits.length));
  for (let rank = 0; rank < depth; rank += 1) {
    for (const hits of perQuery) {
      const hit = [...hits].sort((a, b) => a.rank - b.rank)[rank];
      const domain = hit ? hostOf(hit.domain || hit.url) : '';
      if (!hit || !domain || domain === own || seen.has(domain)) continue;
      seen.add(domain);
      out.push(hit);
    }
  }
  return out.slice(0, Math.max(0, limit));
};

const pool = async <T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      out[index] = await work(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, worker));
  return out;
};

/**
 * Real competitor content for the consensus: SERP lookup of the queries, then one polite single-page fetch
 * per ranking domain through the existing crawler. No SERP source or no readable page means "unavailable".
 */
export const collectBaseline = async (deps: BenchmarkDeps, input: CollectInput): Promise<CollectOutcome> => {
  const { fetchSerp } = deps;
  if (!fetchSerp) return { status: 'unavailable', reason: 'no-serp-source' };
  const queries = [...new Set(input.queries.map((query) => query.trim()).filter(Boolean))].slice(0, DEFAULT_QUERIES);
  if (!queries.length) return { status: 'unavailable', reason: 'no-queries' };

  const hits: SerpHit[][] = [];
  const sources = new Set<string>();
  let lastError = '';
  for (const [index, query] of queries.entries()) {
    if (input.signal?.aborted) return { status: 'cancelled' };
    input.onProgress?.({ phase: 'serp', done: index, total: queries.length });
    try {
      const response = await fetchSerp(query, input.signal);
      sources.add(response.source);
      hits.push(response.hits);
    } catch (error) {
      lastError = messageOf(error);
    }
  }
  if (input.signal?.aborted) return { status: 'cancelled' };
  if (!hits.length) return { status: 'unavailable', reason: 'serp-failed', error: lastError };

  const chosen = pickDocuments(hits, input.startUrl, input.maxDocs ?? DEFAULT_DOCS);
  if (!chosen.length) return { status: 'unavailable', reason: 'no-documents' };
  let done = 0;
  const fetched = await pool(chosen, input.concurrency ?? DEFAULT_CONCURRENCY, async (hit): Promise<BaselineDoc | null> => {
    try {
      if (input.signal?.aborted) return null;
      const result = await deps.crawlSite({ url: hit.url, maxPages: 1, signal: input.signal });
      const sections = result.pages[0]?.content_sections ?? [];
      return sections.length ? { url: hit.url, rank: hit.rank, sections } : null;
    } catch {
      return null;
    } finally {
      done += 1;
      input.onProgress?.({ phase: 'fetch', done, total: chosen.length, url: hit.url });
    }
  });
  if (input.signal?.aborted) return { status: 'cancelled' };
  const docs = fetched.filter((doc): doc is BaselineDoc => doc !== null);
  if (!docs.length) return { status: 'unavailable', reason: 'no-documents' };
  return { status: 'ok', docs, queries, source: [...sources].sort().join(', '), failed: chosen.length - docs.length };
};
