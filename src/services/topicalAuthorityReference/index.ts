export * from './types';
export { runReference } from './run';
export { buildTopicalBenchmark, BENCHMARK_COMPETITORS } from './benchmark';
export { createReferenceDeps, createSuggestionFetcher, type SuggestionFetcher } from './adapter';
export { generateGapBrief, clearAuthorityBriefCache, type AuthorityBriefOutcome } from './aiBrief';
