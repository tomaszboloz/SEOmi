import { LOCAL_OLLAMA_URL } from '@/services/embeddingClustering';
import { createProvider } from '@/services/embeddings/registry';
import { normalize } from '@/services/embeddings/vector';
import type { ReferenceTaxonomy } from '@/services/topicalAuthority';

/**
 * Optional neural centroid for the Decay Radar (#98), through a local Ollama embedding model the user already runs.
 * The page texts of SERP documents are not stored, so the model embeds the market's weighted common vocabulary (the
 * same evidence as the lexical centroid) in small groups and averages the vectors by competitor share. The label names
 * the model, so a snapshot is never compared with the lexical or another model's space.
 */
export const NEURAL_TERMS = 80;
const GROUP = 8;
export interface NeuralCentroid { centroid: Float64Array; model: string }
export interface NeuralOptions { model: string; fetchImpl?: (input: string, init: RequestInit) => Promise<Response>; signal?: AbortSignal }

export const neuralMarketCentroid = async (taxonomy: ReferenceTaxonomy, options: NeuralOptions): Promise<NeuralCentroid | null> => {
  const model = options.model.trim();
  const terms = Object.entries(taxonomy.commonTerms).filter(([, share]) => Number.isFinite(share) && share > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, NEURAL_TERMS);
  if (!model || !terms.length) return null;
  const groups = Array.from({ length: Math.ceil(terms.length / GROUP) }, (_, i) => terms.slice(i * GROUP, (i + 1) * GROUP));
  const provider = createProvider({ provider: 'ollama', ollamaModel: model, ollamaUrl: LOCAL_OLLAMA_URL, fetchImpl: options.fetchImpl });
  const vectors = await provider.embed(groups.map((group) => group.map(([term]) => term).join(' ')));
  options.signal?.throwIfAborted();
  const sum = new Float64Array(vectors[0].length);
  vectors.forEach((vector, i) => { const weight = groups[i].reduce((total, [, share]) => total + share, 0); vector.forEach((value, k) => { sum[k] += value * weight; }); });
  return sum.some((value) => value !== 0) ? { centroid: normalize(sum), model: `tas-reference-ollama:${model}-v1` } : null;
};
