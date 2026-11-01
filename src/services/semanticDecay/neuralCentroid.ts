import { LOCAL_OLLAMA_URL } from '@/services/embeddingClustering';
import { createProvider } from '@/services/embeddings/registry';
import { normalize } from '@/services/embeddings/vector';
import type { CompetitorPages, ReferenceTaxonomy } from '@/services/topicalAuthority';

/**
 * Optional neural centroid for the Decay Radar (#98), through a local Ollama embedding model the user already runs.
 * With at least three competitor pages that carry crawled text, the model embeds a bounded digest of each page (title,
 * description, lead paragraphs; the crawl already stores them as RAG sections) and averages the vectors. Otherwise it
 * embeds the market's weighted common vocabulary in small groups. The label names the model and the input, so a snapshot
 * is never compared with the lexical or another model's space. Page text goes only to the configured Ollama origin.
 */
export const NEURAL_TERMS = 80;
export const DIGEST_CHARS = 600;
export const MAX_DIGESTS = 30;
export const MIN_DIGESTS = 3;
const PAGES_PER_COMPETITOR = 3;
const GROUP = 8;
export interface NeuralCentroid { centroid: Float64Array; model: string }
export interface NeuralOptions { model: string; competitors?: CompetitorPages[]; fetchImpl?: (input: string, init: RequestInit) => Promise<Response>; signal?: AbortSignal }

/** Bounded text digest of one crawled page: title, description and lead paragraphs, whitespace-normalised. */
export const pageDigest = (page: CompetitorPages['pages'][number]): string => {
  const parts = [page.title, page.meta_description, ...(page.rag_sections ?? []).flatMap((section) => section.paragraphs)];
  return parts.filter((part): part is string => !!part).join(' ').split(/\s+/u).filter(Boolean).join(' ').slice(0, DIGEST_CHARS);
};

const average = (vectors: ArrayLike<number>[], weights: number[]): Float64Array => {
  const sum = new Float64Array(vectors[0].length);
  vectors.forEach((vector, i) => { for (let k = 0; k < sum.length; k += 1) sum[k] += vector[k] * weights[i]; });
  return sum;
};

export const neuralMarketCentroid = async (taxonomy: ReferenceTaxonomy, options: NeuralOptions): Promise<NeuralCentroid | null> => {
  const model = options.model.trim();
  const digests = (options.competitors ?? []).flatMap((competitor) => competitor.pages.slice(0, PAGES_PER_COMPETITOR).map(pageDigest)).filter(Boolean).slice(0, MAX_DIGESTS);
  const useDigests = !!model && digests.length >= MIN_DIGESTS;
  const terms = Object.entries(taxonomy.commonTerms).filter(([, share]) => Number.isFinite(share) && share > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, NEURAL_TERMS);
  if (!model || (!useDigests && !terms.length)) return null;
  const groups = Array.from({ length: Math.ceil(terms.length / GROUP) }, (_, i) => terms.slice(i * GROUP, (i + 1) * GROUP));
  const provider = createProvider({ provider: 'ollama', ollamaModel: model, ollamaUrl: LOCAL_OLLAMA_URL, fetchImpl: options.fetchImpl });
  const vectors = await provider.embed(useDigests ? digests : groups.map((group) => group.map(([term]) => term).join(' ')));
  options.signal?.throwIfAborted();
  const weights = useDigests ? vectors.map(() => 1) : groups.map((group) => group.reduce((total, [, share]) => total + share, 0));
  const sum = average(vectors, weights);
  return sum.some((value) => value !== 0) ? { centroid: normalize(sum), model: `tas-reference-ollama:${model}-${useDigests ? 'pages-' : ''}v1` } : null;
};
