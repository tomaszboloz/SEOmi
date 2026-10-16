import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildGaps, buildInsights, buildRanking, industryAverage, summarize, targetFor } from './analysis';
import { hostOf, pickCompetitors, type DomainCandidate } from './domains';
import type { BenchmarkDeps, BenchmarkInput, BenchmarkOutcome, CompetitorResult, SerpHit } from './types';

export const DEFAULT_QUERIES = 3;
export const DEFAULT_COMPETITORS = 10;
export const DEFAULT_PAGES = 20;
export const DEFAULT_CONCURRENCY = 2;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const benchmarkQueries = (input: BenchmarkInput): string[] => {
  const { coreTopic } = input.report;
  const terms = coreTopic.terms.map((term) => term.term.trim()).filter(Boolean);
  const label = coreTopic.label.trim();
  const unique = [...new Set(terms.length ? terms : label ? [label] : [])];
  return unique.slice(0, Math.max(1, input.maxQueries ?? DEFAULT_QUERIES));
};

const crawlOne = async (deps: BenchmarkDeps, input: BenchmarkInput, candidate: DomainCandidate, pages: number, onPages: (n: number) => void): Promise<CompetitorResult> => {
  const base = { domain: candidate.domain, startUrl: candidate.startUrl, serpAppearances: candidate.appearances, bestRank: candidate.bestRank };
  if (input.signal?.aborted) return { ...base, status: 'failed', failure: 'cancelled' };
  let crawled;
  try {
    crawled = await deps.crawlSite({ url: candidate.startUrl, maxPages: pages, signal: input.signal, onPages });
  } catch (error) {
    return { ...base, status: 'failed', failure: 'crawl-error', error: messageOf(error) };
  }
  if (crawled.cancelled && input.signal?.aborted) return { ...base, status: 'failed', failure: 'cancelled' };
  if (!crawled.pages.length) return { ...base, status: 'failed', failure: 'no-pages' };
  try {
    const report = buildSiteFocusReport(crawled.pages, candidate.startUrl, { language: input.report.model.language || undefined });
    return { ...base, status: 'ok', summary: summarize(report) };
  } catch (error) {
    return { ...base, status: 'failed', failure: 'analysis-failed', error: messageOf(error) };
  }
};

/** Bounded worker pool; results keep input order. */
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
 * Competitive benchmark from real data only: SERP lookups for Core Topic terms, a capped crawl of each
 * top-ranking domain and the same SFS engine applied to every competitor. Dependencies are injected.
 */
export const runBenchmark = async (deps: BenchmarkDeps, input: BenchmarkInput): Promise<BenchmarkOutcome> => {
  const { fetchSerp, now = () => new Date().toISOString() } = deps;
  if (!fetchSerp) return { status: 'unavailable', reason: 'no-serp-source' };
  const queries = benchmarkQueries(input);
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
  input.onProgress?.({ phase: 'serp', done: queries.length, total: queries.length });
  if (!hits.length) return { status: 'unavailable', reason: 'serp-failed', error: lastError };

  const candidates = pickCompetitors(hits, input.startUrl, input.maxCompetitors ?? DEFAULT_COMPETITORS);
  if (!candidates.length) return { status: 'unavailable', reason: 'no-competitors' };

  const pages = input.pagesPerCompetitor ?? DEFAULT_PAGES;
  let done = 0;
  const competitors = await pool(candidates, input.concurrency ?? DEFAULT_CONCURRENCY, async (candidate) => {
    const result = await crawlOne(deps, input, candidate, pages, (count) => input.onProgress?.({ phase: 'crawl', done, total: candidates.length, domain: candidate.domain, pages: count }));
    done += 1;
    input.onProgress?.({ phase: 'crawl', done, total: candidates.length, domain: candidate.domain, pages: result.summary?.pageCount ?? 0 });
    return result;
  });
  if (input.signal?.aborted) return { status: 'cancelled' };
  input.onProgress?.({ phase: 'analyze', done: 1, total: 1 });

  const ownDomain = hostOf(input.startUrl) || input.startUrl;
  const ranking = buildRanking(input.report, ownDomain, competitors);
  const { gaps, competitorTerms } = buildGaps(input.report, competitors);
  return {
    status: 'ok',
    report: {
      queries,
      serpSource: [...sources].sort().join(', '),
      ranking,
      ownRank: ranking.findIndex((row) => row.isOwn) + 1,
      competitors,
      industryAverage: industryAverage(competitors),
      insights: buildInsights(input.report, competitors),
      targetScore: targetFor(competitors, input.targetScore),
      gaps,
      competitorTerms,
      pagesPerCompetitor: pages,
      generatedAt: now(),
    },
  };
};
