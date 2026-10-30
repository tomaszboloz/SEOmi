/**
 * Shared semantic source contract (#86, #85, #106). One embedding set is computed once per
 * project/run/model and handed to every analysis (Site Focus, Topical Authority) instead of each
 * module embedding the same pages again. Vectors from different models are never mixed.
 */
export interface EmbeddingSet {
  /** Registry provider id, e.g. `ollama`, `local`, `hybrid`. */
  providerId: string;
  /** Model or configuration name; part of the cache identity. */
  model: string;
  /** Vector length shared by every entry; entries of another length are ignored. */
  dimensions: number;
  /** Page vectors keyed by normalized URL (see `normalizeUrl`). */
  byUrl?: ReadonlyMap<string, ArrayLike<number>>;
  /** Term vectors keyed by the Site Focus term key. */
  byTerm?: ReadonlyMap<string, ArrayLike<number>>;
}

/**
 * Honest similarity mode of a report:
 * - `semantic`: an embedding (or injected) similarity actually contributed;
 * - `tfidf-only`: vector-space TF-IDF only, so synonyms such as "glucometer" and "blood sugar meter" score 0;
 * - `lexical`: degraded tokenization or the forced lexical formula.
 */
export type SimilarityMode = 'semantic' | 'tfidf-only' | 'lexical';

/** Provenance written next to a report so readers can tell which similarity produced it. */
export interface SimilaritySource {
  mode: SimilarityMode;
  /** `embeddings` when an EmbeddingSet was used, `custom` for an injected hook, `none` otherwise. */
  kind: 'embeddings' | 'custom' | 'none';
  providerId?: string;
  model?: string;
  dimensions?: number;
  /** Term pairs (SFS) or page pairs (TAS) for which a finite semantic similarity was used. */
  pairsUsed: number;
}
