import type { EmbeddingProvider, Vector } from './types.ts';
import { createLocalHashProvider } from './localProvider.ts';
import { createOllamaEmbeddingProvider } from './ollama.ts';
import { concatenate } from './vector.ts';

export interface ProviderSettings {
  provider: string;
  dimensions?: number;
  ollamaUrl?: string;
  ollamaModel?: string;
  /** Weight of the Ollama part in the hybrid provider (0..1). */
  ollamaWeight?: number;
  /** Texts used to fit the local provider's IDF (usually the whole input). */
  corpus?: string[];
  /** HTTP implementation for Ollama requests (tests, custom transports). */
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
}

/**
 * Combines several providers into one vector space. A local lexical model and
 * a neural Ollama model fail on different inputs, so the blend is usually
 * more accurate than either alone.
 */
export const createHybridProvider = (parts: Array<{ provider: EmbeddingProvider; weight: number }>): EmbeddingProvider => ({
  id: 'hybrid',
  model: parts.map((part) => `${part.provider.id}:${part.provider.model}@${part.weight}`).join('+'),
  async embed(texts: string[]) {
    const results = await Promise.all(parts.map((part) => part.provider.embed(texts)));
    return texts.map((_, index): Vector => concatenate(parts.map((part, partIndex) => ({ vector: results[partIndex][index], weight: part.weight }))));
  },
});

const local = (settings: ProviderSettings) => {
  const provider = createLocalHashProvider({ dimensions: settings.dimensions });
  if (settings.corpus?.length) provider.fit(settings.corpus);
  return provider;
};

const ollama = (settings: ProviderSettings) => createOllamaEmbeddingProvider({ baseUrl: settings.ollamaUrl, model: settings.ollamaModel, fetchImpl: settings.fetchImpl });

/** Register new providers here; the CLI and evaluator pick them up by name. */
export const PROVIDER_FACTORIES: Record<string, (settings: ProviderSettings) => EmbeddingProvider> = {
  local,
  ollama,
  hybrid: (settings) => {
    const weight = Math.min(1, Math.max(0, settings.ollamaWeight ?? 0.5));
    return createHybridProvider([{ provider: local(settings), weight: 1 - weight }, { provider: ollama(settings), weight }]);
  },
};

/**
 * Cosine levels differ by model: sparse lexical hashes of short queries score
 * around 0.2 within a topic, neural models around 0.6. Thresholds were
 * calibrated for cluster purity on the SEO fixtures; tune with your data.
 */
export const DEFAULT_CLUSTER_THRESHOLD: Record<string, number> = { local: 0.12, ollama: 0.6, hybrid: 0.35 };

export const createProvider = (settings: ProviderSettings): EmbeddingProvider => {
  const factory = PROVIDER_FACTORIES[settings.provider];
  if (!factory) throw new Error(`Unknown embedding provider "${settings.provider}". Available: ${Object.keys(PROVIDER_FACTORIES).join(', ')}`);
  return factory(settings);
};
