import type { CodeParams, SiteFocusReport } from '@/services/siteFocus';
import type { BenchmarkDeps, SerpHit } from '@/services/siteFocusBenchmark';
import type { CompetitorPages, Quadrant, ReferenceTaxonomy } from '@/services/topicalAuthority';

export interface ReferenceDeps extends Pick<BenchmarkDeps, 'fetchSerp' | 'crawlSite' | 'now'> {
  /** Google Suggest phrases for a query; failures must resolve to an empty list. */
  fetchSuggestions?: (keyword: string, signal?: AbortSignal) => Promise<string[]>;
}

export interface ReferenceInput {
  report: SiteFocusReport;
  startUrl: string;
  maxQueries?: number;
  maxCompetitors?: number;
  pagesPerCompetitor?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: ReferenceProgress) => void;
}

export type ReferenceProgress =
  | { phase: 'serp'; done: number; total: number }
  | { phase: 'crawl'; done: number; total: number; domain: string }
  | { phase: 'build'; done: number; total: number };

export type ReferenceUnavailable = 'no-serp-source' | 'no-queries' | 'serp-failed' | 'no-competitors' | 'no-pages' | 'no-taxonomy';

export type ReferenceOutcome =
  | { status: 'unavailable'; reason: ReferenceUnavailable; error?: string }
  | { status: 'cancelled' }
  | { status: 'ok'; taxonomy: ReferenceTaxonomy; competitors: CompetitorPages[]; serp?: ReferenceSerpObservation[]; attempted?: string[] };

/** One SERP response actually received during the reference run (query, provider label and ranked hits). */
export interface ReferenceSerpObservation { query: string; source: string; hits: SerpHit[] }

export interface BenchmarkRow { domain: string; sfs: number; tas: number | null; quadrant: Quadrant | null; isOwn: boolean }
export interface PillarComparison { id: string; label: string; own: number; competitors: Record<string, number> }
export interface AuthorityInsight { code: 'lead-pillar' | 'trailing-pillars' | 'rank'; params: CodeParams }

/** Topical Gap Matrix against the top-ranking competitors (real crawled data only). */
export interface TopicalBenchmark {
  builtAt: string;
  source: string;
  rows: BenchmarkRow[];
  ownRank: number;
  pillars: PillarComparison[];
  insights: AuthorityInsight[];
  /** Real sample behind the matrix: competitors picked from the SERP, scored, and those whose crawl failed or was empty. */
  sample?: { attempted: number; scored: number; failed: string[] };
}
