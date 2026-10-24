import type { EmbeddingProvider, Vector } from '@/services/embeddings/types';
import { usableVector } from './sources';

export const embedIndependentSources = async (provider: EmbeddingProvider, texts: string[], signal: AbortSignal) => {
  const embedOne = async (text: string): Promise<Vector | null> => {
    try {
      const vectors = await provider.embed([text]);
      signal.throwIfAborted();
      return vectors.length === 1 ? vectors[0] : null;
    } catch {
      signal.throwIfAborted();
      return null;
    }
  };
  const vectors: (Vector | null)[] = texts.map(() => null);
  vectors[0] = await embedOne(texts[0]);
  if (!usableVector(vectors[0])) return vectors;
  let next = 1;
  const worker = async () => {
    while (next < texts.length) {
      signal.throwIfAborted();
      const index = next++;
      vectors[index] = await embedOne(texts[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, texts.length - 1) }, worker));
  return vectors;
};
