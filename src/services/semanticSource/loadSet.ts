import { createProvider } from '@/services/embeddings/registry';
import type { EmbeddingProvider } from '@/services/embeddings/types';
import { buildEmbeddingSet } from './buildSet';
import { cachedProvider, createEmbeddingCache } from './embeddingCache';
import { pageTexts, type TextPage } from './pageTexts';
import { classifyProviderError, type ProviderError } from './providerErrors';
import type { SemanticSettings } from './settings';
import type { EmbeddingSet } from './types';

export type SemanticLoad =
  | { status: 'off' }
  | { status: 'ready'; set: EmbeddingSet; rejected: number; skipped: number }
  | { status: 'fallback'; error: ProviderError | null };

/** Session cache shared by SFS and TAS, so both modules embed a page once per project and model (#85 parse once). */
const cache = createEmbeddingCache();
export const semanticCache = cache;

export interface LoadInput {
  settings: SemanticSettings;
  projectId: string;
  pages: readonly TextPage[];
  signal?: AbortSignal;
  /** Test seam: replaces the registry provider. */
  providerFor?: (settings: SemanticSettings, corpus: string[]) => EmbeddingProvider;
}

const registryProvider = (settings: SemanticSettings, corpus: string[]): EmbeddingProvider => createProvider({
  provider: settings.provider, ollamaUrl: settings.ollamaUrl || undefined, ollamaModel: settings.model, corpus,
});

/** Builds the page embedding set; any provider failure returns `fallback` so callers stay on TF-IDF. */
export const loadSemanticSet = async (input: LoadInput): Promise<SemanticLoad> => {
  const texts = pageTexts(input.pages);
  if (!input.settings.enabled || texts.size === 0) return { status: 'off' };
  try {
    const base = (input.providerFor ?? registryProvider)(input.settings, [...texts.values()]);
    const provider = cachedProvider(base, cache, { projectId: input.projectId, language: null, market: null, profileId: 'page-summary-v1' });
    const result = await buildEmbeddingSet(provider, { pages: texts, signal: input.signal, timeoutMs: input.settings.timeoutMs, maxEntries: input.settings.maxEntries });
    return result.set ? { status: 'ready', set: result.set, rejected: result.rejected, skipped: result.skipped } : { status: 'fallback', error: null };
  } catch (error) {
    return { status: 'fallback', error: classifyProviderError(error) };
  }
};
