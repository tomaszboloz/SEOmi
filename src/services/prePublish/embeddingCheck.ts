import { LOCAL_OLLAMA_URL } from '@/services/embeddingClustering';
import { createProvider, type ProviderSettings } from '@/services/embeddings/registry';
import { checkDraft, PREPUBLISH_PROFILE } from './check';
import { insufficientPrePublish, normalizeDraftUrl, type PrePublishContext } from './context';
import { draftChunkDetails } from './aioChunks';
import { applyPolicy, evidenceGaps, type PrePublishPolicy } from './policy';

/** Majority document language of the baseline crawl; the draft has no language field of its own yet. */
const baselineLanguage = (context: PrePublishContext): string => {
  const counts = new Map<string, number>();
  context.pages.forEach(({ source }) => {
    const lang = (source.document_language ?? '').trim().toLowerCase().split('-')[0];
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  });
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? 'und';
};

export const checkPrePublish = async (
  text: string, url: string, context: PrePublishContext,
  settings: Pick<ProviderSettings, 'provider' | 'ollamaModel'>, signal: AbortSignal, policy: PrePublishPolicy = 'advisory', now = new Date(),
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
  const corpus = context.pages.map(({ score, source }, index) => ({
    url: score.url, trs: score.trs, weight: score.weight, type: score.type, vector: vectors[index + 2],
    links: source.links?.filter((link) => link.is_internal).map((link) => link.target_url),
  }));
  const report = checkDraft({ url: replaced?.score.url ?? normalizedUrl, vector: vectors[1], text: text.trim(),
    chunks: text.trim().split(/\n\s*\n/u).map((chunk) => chunk.trim()) }, corpus, vectors[0]);
  const chunkDetails = draftChunkDetails(text, baselineLanguage(context));
  const gaps = evidenceGaps({ baselineCompletedAt: context.run?.completedAt ?? null, languageStatus: chunkDetails.languageStatus, now });
  return applyPolicy({ ...report, chunkDetails }, policy, gaps);
};
