import { LOCAL_OLLAMA_URL } from '@/services/embeddingClustering';
import { createProvider, type ProviderSettings } from '@/services/embeddings/registry';
import type { EmbeddingProvider } from '@/services/embeddings/types';
import type { TopTenCorpus } from '@/services/targetPhraseAudit/types';
import { buildPhraseIgos, type PhraseIgosOptions } from './phraseIgos';
import type { IgosReport } from './report';

/** Limitation code: the project's semantic embedding provider (#86) failed, so local lexical vectors were used. */
export const SEMANTIC_PROVIDER_UNAVAILABLE = 'semantic-provider-unavailable';

export type IgosEmbeddingSettings = Pick<ProviderSettings, 'provider' | 'ollamaModel'>;
type Factory = (settings: ProviderSettings) => EmbeddingProvider;

/**
 * IGOS with the project's embedding settings (the same ones used by clustering and the pre-publish
 * check). A semantic provider is used when configured; if it fails, the run falls back to local lexical
 * vectors and says so in the limitations instead of hiding the switch.
 */
export const buildPhraseIgosWithSettings = async (
  corpus: TopTenCorpus, settings: IgosEmbeddingSettings, options: PhraseIgosOptions = {}, factory: Factory = createProvider,
): Promise<IgosReport | null> => {
  if (settings.provider !== 'local') {
    try {
      const provider = factory({ provider: settings.provider, ollamaModel: settings.ollamaModel?.trim() || undefined, ollamaUrl: LOCAL_OLLAMA_URL });
      const report = await buildPhraseIgos(corpus, (texts) => provider.embed(texts), false, { ...options, provider: { id: provider.id, model: provider.model } });
      if (report) return report;
    } catch {
      // Falls through to the labelled local run below.
    }
    const local = await buildPhraseIgos(corpus, undefined, true, options);
    return local && { ...local, limitations: [...local.limitations, SEMANTIC_PROVIDER_UNAVAILABLE] };
  }
  return buildPhraseIgos(corpus, undefined, true, options);
};
