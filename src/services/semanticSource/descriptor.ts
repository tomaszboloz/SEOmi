import { contentHash } from '@/services/analysisContracts';
import type { EmbeddingProvider } from '@/services/embeddings/types';
import { safeCosine } from './similarity';

/**
 * Embedding model descriptor (#86 GEM-86-01/02, D02). A cosine is only meaningful between vectors of one
 * space: same provider kind, model, dimensions, normalization, version and (for fitted lexical models)
 * the same corpus. Anything else is `incompatible` and yields null, never a random 0.
 */
export type EmbeddingKind = 'local-hash' | 'tfidf' | 'neural' | 'hybrid';
export type Normalization = 'l2' | 'none';

export interface ModelDescriptor {
  providerId: string;
  model: string;
  kind: EmbeddingKind;
  dimensions: number;
  normalization: Normalization;
  /** Fingerprint of the corpus a lexical model was fitted on; null for corpus-free models. */
  corpusHash: string | null;
  /** Bumped when the SEOmi wrapper changes how vectors are produced. */
  version: number;
}

export type Incompatibility = keyof Omit<ModelDescriptor, 'model'> | 'model';

const KIND_BY_PROVIDER: Record<string, EmbeddingKind> = { 'local-hash': 'local-hash', local: 'local-hash', tfidf: 'tfidf', ollama: 'neural', hybrid: 'hybrid' };

/** Corpus fingerprint independent of document order. */
export const corpusFingerprint = (corpus: readonly string[] | undefined): string | null =>
  corpus?.length ? contentHash([...corpus].map((text) => text.trim()).sort().join('\u0001')) : null;

export const describeModel = (
  provider: Pick<EmbeddingProvider, 'id' | 'model'>,
  dimensions: number,
  options: { corpus?: readonly string[]; normalization?: Normalization; version?: number } = {},
): ModelDescriptor => {
  const kind = KIND_BY_PROVIDER[provider.id] ?? 'neural';
  return {
    providerId: provider.id, model: provider.model, kind, dimensions,
    normalization: options.normalization ?? 'l2',
    corpusHash: kind === 'local-hash' || kind === 'tfidf' || kind === 'hybrid' ? corpusFingerprint(options.corpus) : null,
    version: options.version ?? 1,
  };
};

/** Stable id; part of every cache key so a model or corpus change invalidates cached vectors. */
export const descriptorId = (d: ModelDescriptor): string =>
  [d.providerId, d.model, d.kind, d.dimensions, d.normalization, d.corpusHash ?? '-', `v${d.version}`].join('|');

const FIELDS: Incompatibility[] = ['providerId', 'model', 'kind', 'dimensions', 'normalization', 'corpusHash', 'version'];

export const incompatibilities = (left: ModelDescriptor, right: ModelDescriptor): Incompatibility[] =>
  FIELDS.filter((field) => left[field] !== right[field]);

/** Cosine across two descriptors; null when the spaces differ or a vector is unusable. */
export const comparableCosine = (
  left: { descriptor: ModelDescriptor; vector: ArrayLike<number> },
  right: { descriptor: ModelDescriptor; vector: ArrayLike<number> },
): number | null => {
  if (incompatibilities(left.descriptor, right.descriptor).length) return null;
  if (left.vector.length !== left.descriptor.dimensions) return null;
  return safeCosine(left.vector, right.vector);
};

/**
 * Similarity thresholds are per kind and not interchangeable (D02). A kind without a calibrated value
 * returns null so callers fall back to the lexical path instead of reusing another model's threshold.
 */
export const DEFAULT_SIMILARITY_THRESHOLDS: Partial<Record<EmbeddingKind, number>> = { 'local-hash': 0.12, neural: 0.6, hybrid: 0.35 };

export const similarityThreshold = (d: ModelDescriptor, table: Partial<Record<EmbeddingKind, number>> = DEFAULT_SIMILARITY_THRESHOLDS): number | null =>
  table[d.kind] ?? null;
