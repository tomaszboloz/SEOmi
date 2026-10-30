export * from './types';
export { runReference } from './run';
export { buildTopicalBenchmark, BENCHMARK_COMPETITORS, withSerpEvidence } from './benchmark';
export { createReferenceDeps, createSuggestionFetcher, referenceMarket, type SuggestionFetcher } from './adapter';
export { generateGapBrief, clearAuthorityBriefCache, type AuthorityBriefOutcome } from './aiBrief';
