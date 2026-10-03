import { z } from 'zod';
import { clusterVectors, labelClusters } from './embeddings/cluster.ts';
import { createOllamaGenerator } from './embeddings/ollama.ts';
import { createProvider, DEFAULT_CLUSTER_THRESHOLD } from './embeddings/registry.ts';
import { cosine } from './embeddings/vector.ts';

/**
 * The desktop CSP allows plain HTTP only to this loopback Ollama endpoint, so
 * the app never talks to other HTTP hosts from the WebView.
 */
export const LOCAL_OLLAMA_URL = 'http://127.0.0.1:11434';
export const EMBEDDING_PROVIDERS = ['local', 'ollama', 'hybrid'] as const;
export type EmbeddingProviderName = (typeof EMBEDDING_PROVIDERS)[number];
export const MAX_EMBEDDING_KEYWORDS = 2000;

export const embeddingClusteringResultSchema = z.object({
  method: z.literal('embeddings'),
  provider: z.enum(EMBEDDING_PROVIDERS),
  model: z.string().max(300),
  threshold: z.number().min(0).max(1),
  clusters: z.array(z.object({
    id: z.string().max(40),
    keywords: z.array(z.string().max(500)).min(2).max(MAX_EMBEDDING_KEYWORDS),
    label: z.string().max(80).nullable(),
    cohesion: z.number().min(-1).max(1),
  })).max(MAX_EMBEDDING_KEYWORDS),
  unclusteredKeywords: z.array(z.string().max(500)).max(MAX_EMBEDDING_KEYWORDS),
  analyzedAt: z.string().max(40),
});
export type EmbeddingClusteringResult = z.infer<typeof embeddingClusteringResultSchema>;

export interface EmbeddingClusteringOptions {
  provider: EmbeddingProviderName;
  /** Cosine threshold; defaults to the provider's calibrated value. */
  threshold?: number | null;
  ollamaModel?: string;
  /** Ollama generation model used to name groups; empty means no names. */
  labelModel?: string;
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
  analyzedAt?: string;
}

export const defaultEmbeddingThreshold = (provider: EmbeddingProviderName): number => DEFAULT_CLUSTER_THRESHOLD[provider];

/**
 * Groups keywords by embedding similarity. Keywords that end up alone are
 * reported as unclustered; each group carries its cohesion (mean cosine of its
 * keywords to the group centroid) so weak groups are visible.
 */
export const clusterKeywordsByEmbedding = async (keywords: string[], options: EmbeddingClusteringOptions): Promise<EmbeddingClusteringResult> => {
  if (keywords.length < 2) throw new Error('At least two keywords are needed');
  if (keywords.length > MAX_EMBEDDING_KEYWORDS) throw new Error(`At most ${MAX_EMBEDDING_KEYWORDS} keywords are supported`);
  const threshold = options.threshold ?? defaultEmbeddingThreshold(options.provider);
  const embedder = createProvider({ provider: options.provider, corpus: keywords, ollamaUrl: LOCAL_OLLAMA_URL, ollamaModel: options.ollamaModel?.trim() || undefined, fetchImpl: options.fetchImpl });
  const vectors = await embedder.embed(keywords);
  const all = clusterVectors(vectors, threshold);
  let grouped = all.filter((cluster) => cluster.members.length > 1);
  if (options.labelModel?.trim() && grouped.length) {
    const generate = createOllamaGenerator({ baseUrl: LOCAL_OLLAMA_URL, model: options.labelModel.trim(), fetchImpl: options.fetchImpl });
    grouped = await labelClusters(grouped, keywords, generate);
  }
  return {
    method: 'embeddings',
    provider: options.provider,
    model: embedder.model,
    threshold,
    clusters: grouped.map((cluster, index) => ({
      id: `embedding-${index + 1}`,
      keywords: cluster.members.map((member) => keywords[member]),
      label: cluster.label ?? null,
      cohesion: cluster.members.reduce((sum, member) => sum + cosine(vectors[member], cluster.centroid), 0) / cluster.members.length,
    })),
    unclusteredKeywords: all.filter((cluster) => cluster.members.length === 1).map((cluster) => keywords[cluster.members[0]]),
    analyzedAt: options.analyzedAt ?? new Date().toISOString(),
  };
};
