export type { EmbeddingSet, SimilarityMode, SimilaritySource } from './types';
export { blendSimilarity, describeSource, pageVectorFrom, safeCosine, termSimilarityFrom, usableVector } from './similarity';
export { buildEmbeddingSet, type EmbeddingSetInput, type EmbeddingSetResult } from './buildSet';
