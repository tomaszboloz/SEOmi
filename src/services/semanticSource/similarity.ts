import type { EmbeddingSet, SimilaritySource } from './types';

/** Cosine of two raw vectors; null (unknown) on length mismatch, NaN/Infinity or a zero vector, never a fake 0. */
export const safeCosine = (left: ArrayLike<number> | undefined, right: ArrayLike<number> | undefined): number | null => {
  if (!left || !right || left.length === 0 || left.length !== right.length) return null;
  let dot = 0;
  let a = 0;
  let b = 0;
  for (let index = 0; index < left.length; index += 1) {
    const x = left[index];
    const y = right[index];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    dot += x * y;
    a += x * x;
    b += y * y;
  }
  if (a === 0 || b === 0) return null;
  return Math.max(-1, Math.min(1, dot / Math.sqrt(a * b)));
};

/** Keeps only vectors that match the declared dimensions and are finite and non-zero. */
export const usableVector = (set: EmbeddingSet, vector: ArrayLike<number> | undefined): ArrayLike<number> | undefined =>
  vector && vector.length === set.dimensions && safeCosine(vector, vector) !== null ? vector : undefined;

/** Term-to-term similarity from an embedding set; unknown terms return undefined so the lexical signal stands alone. */
export const termSimilarityFrom = (set: EmbeddingSet | undefined): ((left: string, right: string) => number | undefined) | undefined => {
  const terms = set?.byTerm;
  if (!set || !terms || terms.size === 0) return undefined;
  return (left, right) => safeCosine(usableVector(set, terms.get(left)), usableVector(set, terms.get(right))) ?? undefined;
};

/** Page vector lookup by normalized URL, validated against the set's dimensions. */
export const pageVectorFrom = (set: EmbeddingSet | undefined, url: string): ArrayLike<number> | undefined =>
  set?.byUrl ? usableVector(set, set.byUrl.get(url)) : undefined;

/**
 * Lexical and semantic similarity blended the same way Site Focus blends its term hook:
 * the mean of both when the semantic value is known, the lexical value alone otherwise.
 */
export const blendSimilarity = (lexical: number, semantic: number | null | undefined): number =>
  typeof semantic === 'number' && Number.isFinite(semantic) ? (lexical + Math.max(0, Math.min(1, semantic))) / 2 : lexical;

/** Provenance for a report: `semantic` only when a semantic value was really used at least once. */
export const describeSource = (
  lexicalOnly: boolean, pairsUsed: number, set: EmbeddingSet | undefined, custom: boolean,
): SimilaritySource => {
  const kind = set && pairsUsed > 0 ? 'embeddings' : custom && pairsUsed > 0 ? 'custom' : 'none';
  const mode = lexicalOnly ? 'lexical' : pairsUsed > 0 ? 'semantic' : 'tfidf-only';
  return {
    mode, kind, pairsUsed,
    ...(kind === 'embeddings' && set ? { providerId: set.providerId, model: set.model, dimensions: set.dimensions } : {}),
  };
};
