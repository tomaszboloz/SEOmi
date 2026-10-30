import { artifactKey } from '@/services/analysisContracts';
import type { EmbeddingProvider, Vector } from '@/services/embeddings/types';

/**
 * Shared embedding cache (#86 GEM-86-07, T05; #85 GEM-85-04, T04). SFS, TAS and other modules wrap their
 * provider with `cachedProvider`, so one page text is embedded once per project, model, language, market
 * and profile. Changing any of those invalidates the entry; nothing is shared across projects.
 * In memory only: vectors are cheap to recompute and must not outlive the session on disk.
 */
export interface EmbeddingCacheScope {
  projectId: string;
  language: string | null;
  market: string | null;
  profileId: string | null;
  /** Usually `descriptorId(...)`; defaults to provider id and model. */
  modelId?: string;
}

export interface EmbeddingCache {
  get: (key: string) => Vector | undefined;
  set: (key: string, vector: Vector) => void;
  clearProject: (projectId: string) => void;
  stats: () => { size: number; hits: number; misses: number };
}

export const EMBEDDING_CACHE_VERSION = 1;

export const createEmbeddingCache = (maxEntries = 5000): EmbeddingCache => {
  const entries = new Map<string, Vector>();
  let hits = 0;
  let misses = 0;
  return {
    get: (key) => {
      const vector = entries.get(key);
      if (vector) {
        hits += 1;
        entries.delete(key);
        entries.set(key, vector);
      } else misses += 1;
      return vector;
    },
    set: (key, vector) => {
      entries.delete(key);
      entries.set(key, vector);
      while (entries.size > Math.max(1, maxEntries)) entries.delete(entries.keys().next().value as string);
    },
    clearProject: (projectId) => {
      const prefix = `${projectId.trim()}\u0000`;
      [...entries.keys()].filter((key) => key.startsWith(prefix)).forEach((key) => entries.delete(key));
    },
    stats: () => ({ size: entries.size, hits, misses }),
  };
};

/** Provider that answers repeated texts from the cache and embeds only the misses (deduplicated). */
export const cachedProvider = (provider: EmbeddingProvider, cache: EmbeddingCache, scope: EmbeddingCacheScope): EmbeddingProvider => {
  const modelId = scope.modelId ?? `${provider.id}:${provider.model}`;
  const keyOf = (text: string) => artifactKey({
    projectId: scope.projectId, kind: 'embedding', content: text, modelId,
    language: scope.language, market: scope.market, profileId: scope.profileId, algorithmVersion: EMBEDDING_CACHE_VERSION,
  });
  return {
    id: provider.id,
    model: provider.model,
    async embed(texts) {
      const found = texts.map((text) => cache.get(keyOf(text)));
      const missing = [...new Set(texts.filter((_, index) => !found[index]))];
      const fresh = new Map<string, Vector>();
      if (missing.length) {
        const vectors = await provider.embed(missing);
        if (vectors.length !== missing.length) throw new Error('Embedding provider returned an unexpected number of vectors');
        missing.forEach((text, index) => {
          const vector = vectors[index];
          fresh.set(text, vector);
          // Invalid vectors (NaN, zero) are returned for the caller to reject but never cached.
          if (vector?.length && vector.every(Number.isFinite) && vector.some((value) => value !== 0)) cache.set(keyOf(text), vector);
        });
      }
      return texts.map((text, index) => found[index] ?? (fresh.get(text) as Vector));
    },
  };
};
