import { cosine, normalize } from '@/services/embeddings/vector';

export interface CacheEntry {
  /** Task embedding (any dimension, same model for the whole cache). */
  vector: ArrayLike<number>;
  response: string;
  costUsd: number;
}

export interface CacheHit { entry: CacheEntry; similarity: number }

export const DEFAULT_CACHE_THRESHOLD = 0.95;

/** Returns the most similar earlier task when its cosine similarity reaches the threshold; otherwise null. */
export const findCached = (
  task: ArrayLike<number>,
  history: CacheEntry[],
  threshold = DEFAULT_CACHE_THRESHOLD,
): CacheHit | null => {
  const query = normalize(task);
  let best: CacheHit | null = null;
  for (const entry of history) {
    if (entry.vector.length !== query.length) continue;
    const similarity = cosine(query, normalize(entry.vector));
    if (similarity >= threshold && (!best || similarity > best.similarity)) best = { entry, similarity };
  }
  return best;
};
