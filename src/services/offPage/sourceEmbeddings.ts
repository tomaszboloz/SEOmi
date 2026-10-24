import { LOCAL_OLLAMA_URL } from '@/services/embeddingClustering';
import { createProvider, type ProviderSettings } from '@/services/embeddings/registry';
import type { SourceAnalysis } from './sources';
import { usableVector } from './sources';
import { embedIndependentSources } from './sourceOllama';

export type SourceEmbeddingSettings = Pick<ProviderSettings, 'provider' | 'ollamaModel'>;
export const embedSources = async (
  analysis: SourceAnalysis, coreText: string, settings: SourceEmbeddingSettings, signal: AbortSignal,
): Promise<SourceAnalysis> => {
  signal.throwIfAborted();
  if (!coreText.trim()) return analysis;
  const sources = analysis.sources.filter((source) => source.availability === 'ok');
  const texts = [coreText, ...sources.map((source) => source.text)];
  try {
    if (!['local', 'ollama'].includes(settings.provider)) return analysis;
    const provider = createProvider({
      provider: settings.provider, ollamaModel: settings.ollamaModel?.trim() || undefined,
      ollamaUrl: LOCAL_OLLAMA_URL, corpus: texts,
      fetchImpl: (input, init) => {
        signal.throwIfAborted();
        return fetch(input, { ...init, signal: init.signal ? AbortSignal.any([signal, init.signal]) : signal });
      },
    });
    const identity = `${provider.id}:${provider.model}`;
    const vectors = settings.provider === 'ollama' ? await embedIndependentSources(provider, texts, signal) : await provider.embed(texts);
    signal.throwIfAborted();
    if (identity !== `${provider.id}:${provider.model}` || vectors.length !== texts.length || !usableVector(vectors[0])) return analysis;
    const topic = vectors[0];
    return { ...analysis, topic, sources: analysis.sources.map((source) => {
      const index = sources.indexOf(source);
      const vector = vectors[index + 1];
      return { ...source, vector: index >= 0 && usableVector(vector) && vector.length === topic.length ? vector : null };
    }) };
  } catch {
    signal.throwIfAborted();
    return analysis;
  }
};
