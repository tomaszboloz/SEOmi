import type { CodeParams, FocusPage, SfsBand, SiteFocusReport } from '@/services/siteFocus';

/** Benchmark contracts. Wording is code plus params: the UI localizes. */

export interface SerpHit { rank: number; url: string; domain: string }
export interface SerpResponse { source: string; hits: SerpHit[] }

export interface CrawlRequest { url: string; maxPages: number; signal?: AbortSignal; onPages?: (done: number) => void }
export interface CrawlResponse { pages: FocusPage[]; cancelled?: boolean }

export interface BenchmarkDeps {
  /** Missing when no SERP source is configured: the run reports `no-serp-source`. */
  fetchSerp?: (keyword: string, signal?: AbortSignal) => Promise<SerpResponse>;
  crawlSite: (request: CrawlRequest) => Promise<CrawlResponse>;
  now?: () => string;
}

export interface BenchmarkInput {
  report: SiteFocusReport;
  /** Own site start URL. */
  startUrl: string;
  maxQueries?: number;
  maxCompetitors?: number;
  pagesPerCompetitor?: number;
  concurrency?: number;
  /** Overrides the derived target score. */
  targetScore?: number;
  signal?: AbortSignal;
  onProgress?: (progress: BenchmarkProgress) => void;
}

export type BenchmarkProgress =
  | { phase: 'serp'; done: number; total: number }
  | { phase: 'crawl'; done: number; total: number; domain: string; pages: number }
  | { phase: 'analyze'; done: number; total: number };

export type CompetitorFailure = 'crawl-error' | 'no-pages' | 'analysis-failed' | 'cancelled';

export interface CompetitorSummary {
  score: number;
  band: SfsBand;
  confidence: number;
  onTopicRatio: number;
  pageCount: number;
  offTopicPages: number;
  coreTerms: string[];
}

export interface CompetitorResult {
  domain: string;
  startUrl: string;
  /** Queries (of those asked) in which the domain appeared. */
  serpAppearances: number;
  bestRank: number;
  status: 'ok' | 'failed';
  failure?: CompetitorFailure;
  error?: string;
  summary?: CompetitorSummary;
}

export interface RankingRow {
  domain: string;
  isOwn: boolean;
  rank: number;
  score: number;
  band: SfsBand;
  onTopicRatio: number;
  offTopicPages: number;
  pageCount: number;
}

export interface BenchmarkInsight { code: 'on-topic-share' | 'off-topic-pages' | 'keyword-coverage' | 'versus-average'; params: CodeParams }

export interface CompetitorGap {
  term: string;
  /** Percent of successfully crawled competitors whose core topic uses the term. */
  coveragePct: number;
  competitors: number;
}

export interface BenchmarkReport {
  queries: string[];
  serpSource: string;
  ranking: RankingRow[];
  ownRank: number;
  competitors: CompetitorResult[];
  industryAverage: number | null;
  insights: BenchmarkInsight[];
  targetScore: number;
  gaps: CompetitorGap[];
  /** Feed to `buildSiteFocusReport(..., { competitorTerms })`. */
  competitorTerms: string[];
  pagesPerCompetitor: number;
  generatedAt: string;
}

export type UnavailableReason = 'no-serp-source' | 'no-queries' | 'serp-failed' | 'no-competitors';

export type BenchmarkOutcome =
  | { status: 'unavailable'; reason: UnavailableReason; error?: string }
  | { status: 'cancelled' }
  | { status: 'ok'; report: BenchmarkReport };
