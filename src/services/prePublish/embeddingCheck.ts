import { LOCAL_OLLAMA_URL } from '@/services/embeddingClustering';
import { createProvider, type ProviderSettings } from '@/services/embeddings/registry';
import { checkDraft, PREPUBLISH_PROFILE } from './check';
import { insufficientPrePublish, normalizeDraftUrl, type PrePublishContext } from './context';

export const checkPrePublish = async (
  text: string, url: string, context: PrePublishContext,
  settings: Pick<ProviderSettings, 'provider' | 'ollamaModel'>, signal: AbortSignal,
) => {
  signal.throwIfAborted();
  if (!context.coreText) return insufficientPrePublish('no-core');
  if (context.pages.length < PREPUBLISH_PROFILE.minPages) return insufficientPrePublish('corpus-too-small');
  const normalizedUrl = normalizeDraftUrl(url);
  if (normalizedUrl === null || !text.trim()) throw new Error('Invalid draft');
  const texts = [context.coreText, text.trim(), ...context.pages.map((page) => page.text)];
  const provider = createProvider({
    ...settings, ollamaModel: settings.ollamaModel?.trim() || undefined,
    ollamaUrl: LOCAL_OLLAMA_URL, corpus: texts,
    fetchImpl: (input, init) => {
      signal.throwIfAborted();
      return fetch(input, { ...init, signal: init.signal ? AbortSignal.any([signal, init.signal]) : signal });
    },
  });
  const identity = `${provider.id}:${provider.model}`;
  const vectors = await provider.embed(texts);
  signal.throwIfAborted();
  if (identity !== `${provider.id}:${provider.model}` || vectors.length !== texts.length
    || vectors.some((vector) => !vector.length || vector.length !== vectors[0].length
      || !vector.every(Number.isFinite) || !vector.some((value) => value !== 0))) {
    return insufficientPrePublish('dimension-mismatch');
  }
  const replaced = normalizedUrl ? context.pages.find(({ source }) =>
    [source.url, source.final_url].some((candidate) => candidate && normalizeDraftUrl(candidate) === normalizedUrl)) : undefined;
  const corpus = context.pages.map(({ score }, index) => ({
    url: score.url, trs: score.trs, weight: score.weight, type: score.type, vector: vectors[index + 2],
  }));
  return checkDraft({ url: replaced?.score.url ?? normalizedUrl, vector: vectors[1],
    chunks: text.trim().split(/\n\s*\n/u).map((chunk) => chunk.trim()) }, corpus, vectors[0]);
};
