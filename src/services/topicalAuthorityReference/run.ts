import { pickCompetitors, type SerpHit } from '@/services/siteFocusBenchmark';
import { benchmarkQueries, DEFAULT_COMPETITORS, DEFAULT_CONCURRENCY, DEFAULT_PAGES, DEFAULT_QUERIES } from '@/services/siteFocusBenchmark/benchmark';
import { buildTaxonomy, type CompetitorPages } from '@/services/topicalAuthority';
import { coreKeysOf, gatedSiteFocus } from '@/services/topicalAuthority/context';
import type { FocusPage } from '@/services/siteFocus';
import type { ReferenceDeps, ReferenceInput, ReferenceOutcome, ReferenceSerpObservation } from './types';

const MAX_SUGGESTIONS = 100;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

type ReferenceRunInput = ReferenceInput & { pages?: FocusPage[] };

const pool = async <T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) { const index = next++; out[index] = await work(items[index]); }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, worker));
  return out;
};

/**
 * Builds the reference taxonomy from real data: SERP leaders for the Core Topic queries are crawled (capped, polite) and
 * their headings, entities and questions become the sub-topic map; Google Suggest adds user phrasing. Nothing is invented.
 */
export const runReference = async (deps: ReferenceDeps, input: ReferenceRunInput): Promise<ReferenceOutcome> => {
  const { fetchSerp, now = () => new Date().toISOString() } = deps;
  if (!fetchSerp) return { status: 'unavailable', reason: 'no-serp-source' };
  const report = input.pages ? gatedSiteFocus(input.pages, input.startUrl, input.report).report : input.report;
  const queries = benchmarkQueries({ report, startUrl: input.startUrl, maxQueries: input.maxQueries ?? DEFAULT_QUERIES });
  if (!queries.length) return { status: 'unavailable', reason: 'no-queries' };
  const hits: SerpHit[][] = [];
  const serp: ReferenceSerpObservation[] = [];
  const sources = new Set<string>();
  const suggestions = new Set<string>();
  const paa = new Set<string>();
  let lastError = '';
  for (const [index, query] of queries.entries()) {
    if (input.signal?.aborted) return { status: 'cancelled' };
    input.onProgress?.({ phase: 'serp', done: index, total: queries.length });
    try {
      const response = await fetchSerp(query, input.signal);
      sources.add(response.source);
      hits.push(response.hits);
      serp.push({ query, source: response.source, hits: response.hits });
      (response.questions ?? []).forEach((question) => paa.add(question));
    } catch (error) { lastError = messageOf(error); }
    (await deps.fetchSuggestions?.(query, input.signal)?.catch(() => [] as string[]) ?? []).forEach((phrase) => suggestions.add(phrase));
  }
  input.onProgress?.({ phase: 'serp', done: queries.length, total: queries.length });
  if (!hits.length) return { status: 'unavailable', reason: 'serp-failed', error: lastError };
  const candidates = pickCompetitors(hits, input.startUrl, input.maxCompetitors ?? DEFAULT_COMPETITORS);
  if (!candidates.length) return { status: 'unavailable', reason: 'no-competitors' };
  let done = 0;
  const crawled = await pool(candidates, input.concurrency ?? DEFAULT_CONCURRENCY, async (candidate): Promise<CompetitorPages | null> => {
    if (input.signal?.aborted) return null;
    input.onProgress?.({ phase: 'crawl', done, total: candidates.length, domain: candidate.domain });
    const result = await deps.crawlSite({ url: candidate.startUrl, maxPages: input.pagesPerCompetitor ?? DEFAULT_PAGES, signal: input.signal }).catch(() => null);
    done += 1;
    input.onProgress?.({ phase: 'crawl', done, total: candidates.length, domain: candidate.domain });
    return result && !result.cancelled && result.pages.length ? { domain: candidate.domain, pages: result.pages } : null;
  });
  if (input.signal?.aborted) return { status: 'cancelled' };
  const competitors = crawled.filter((item): item is CompetitorPages => item !== null);
  if (!competitors.length) return { status: 'unavailable', reason: 'no-pages' };
  input.onProgress?.({ phase: 'build', done: 0, total: 1 });
  const model = report.model;
  const taxonomy = buildTaxonomy({
    coreLabel: report.coreTopic.label, coreKeys: coreKeysOf(report),
    language: model.language, competitors, suggestions: [...suggestions].slice(0, MAX_SUGGESTIONS), paa: [...paa].slice(0, MAX_SUGGESTIONS), source: [...sources].sort().join(', '), now: now(),
  });
  input.onProgress?.({ phase: 'build', done: 1, total: 1 });
  return taxonomy ? { status: 'ok', taxonomy, competitors, serp, attempted: candidates.map((candidate) => candidate.domain) } : { status: 'unavailable', reason: 'no-taxonomy' };
};
