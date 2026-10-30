export type { EmbeddingSet, SimilarityMode, SimilaritySource } from './types';
export { blendSimilarity, describeSource, pageVectorFrom, safeCosine, termSimilarityFrom, usableVector } from './similarity';
export { buildEmbeddingSet, type EmbeddingSetInput, type EmbeddingSetResult } from './buildSet';
export {
  comparableCosine, corpusFingerprint, DEFAULT_SIMILARITY_THRESHOLDS, describeModel, descriptorId, incompatibilities, similarityThreshold,
  type EmbeddingKind, type Incompatibility, type ModelDescriptor, type Normalization,
} from './descriptor';
export { cachedProvider, createEmbeddingCache, EMBEDDING_CACHE_VERSION, type EmbeddingCache, type EmbeddingCacheScope } from './embeddingCache';
export { classifyProviderError, redactSecrets, withTimeout, type ProviderError, type ProviderFailure } from './providerErrors';
