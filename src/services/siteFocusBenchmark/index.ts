export * from './types';
export { runBenchmark, benchmarkQueries } from './benchmark';
export { pickCompetitors, hostOf } from './domains';
export { buildRanking, buildInsights, buildGaps, industryAverage, targetFor } from './analysis';
export { generateRewriteBrief, sanitizeBrief, clearBriefCache, type BriefDeps, type BriefOutcome, type BriefRequestContext } from './rewriteBrief';
export {
  assertBriefRequestContext,
  BriefRequestContextMismatchError,
  createBenchmarkDeps,
  createBriefDeps,
  createSerpFetcher,
  createCrawler,
  competitorCrawlConfig,
} from './adapter';
