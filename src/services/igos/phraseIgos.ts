import { createLocalHashProvider } from '@/services/embeddings/localProvider';
import { contentStems } from '@/services/embeddings/text';
import type { Vector } from '@/services/embeddings/types';
import type { TopTenCorpus } from '@/services/targetPhraseAudit/types';
import { buildBaseline } from './baseline';
import { entitiesFromText, entityVocabulary, HEURISTIC_ENTITIES } from './entities';
import { OLLAMA_ENTITIES, OLLAMA_ENTITIES_UNAVAILABLE, type EntityExtractor } from './ollamaEntities';
import { buildIgosReport, type IgosProvenance, type IgosReport } from './report';
export type { IgosProvenance } from './report';
import { CHUNK_PROFILE, chunkSections } from './sections';
import type { CompetitorDoc, TargetDoc } from './types';

export const PHRASE_IGOS_PROFILE = { ...CHUNK_PROFILE, maxEntities: 80 } as const;
/** Limitation code: vectors come from the local lexical hash provider, not a semantic model. */
export const LOCAL_LEXICAL = 'local-lexical-embeddings';

export type Embed = (texts: string[]) => Promise<Vector[]>;

export interface PhraseIgosOptions {
  /** Content language of the phrase, for SPO relation rules. */
  language?: string;
  provider?: { id: string; model: string };
  now?: () => string;
  /** Optional model-backed entity extractor; failures fall back to the heuristic with a limitation. */
  entityExtractor?: EntityExtractor;
}

export const LOCAL_PROVIDER_IDENTITY = { id: 'local-hash', model: 'local-lexical' } as const;

const localEmbed: Embed = async (texts) => {
  const provider = createLocalHashProvider();
  provider.fit(texts);
  return provider.embed(texts);
};

/** Fixed word windows with character offsets into the source text (no headings). */
export const chunkText = (text: string): Array<{ text: string; offset: number }> => chunkSections(text).map(({ text: value, offset }) => ({ text: value, offset }));

const termsOf = (text: string): Map<string, number> => {
  const terms = new Map<string, number>();
  contentStems(text).forEach((term) => terms.set(term, (terms.get(term) ?? 0) + 1));
  return terms;
};

/** IGOS for one phrase from the TOP 10 corpus actually fetched; null when the target page text is missing. */
export const buildPhraseIgos = async (corpus: TopTenCorpus, embed: Embed = localEmbed, lexical = embed === localEmbed, options: PhraseIgosOptions = {}): Promise<IgosReport | null> => {
  if (!corpus.target?.text.trim()) return null;
  const targetChunks = chunkSections(corpus.target.text, corpus.target.headings);
  const pageChunks = corpus.pages.map((page) => chunkSections(page.text, page.headings));
  const texts = [...targetChunks, ...pageChunks.flat()].map((chunk) => chunk.text);
  const vectors = texts.length ? await embed(texts) : [];
  if (vectors.length !== texts.length) return null;
  const vocabulary = entityVocabulary([corpus.target.text, ...corpus.pages.map((page) => page.text)], options.language);
  let cursor = targetChunks.length;
  const state = { used: false, failed: false };
  const entitiesOf = async (text: string): Promise<string[]> => {
    const base = entitiesFromText(text, vocabulary);
    if (!options.entityExtractor) return base;
    try {
      const extra = await options.entityExtractor(text);
      state.used = true;
      return [...new Set([...base, ...extra])];
    } catch {
      state.failed = true;
      return base;
    }
  };
  const targetEntities = await entitiesOf(corpus.target.text);
  const pageEntities: string[][] = [];
  for (const page of corpus.pages) pageEntities.push(await entitiesOf(page.text));
  const target: TargetDoc = {
    url: corpus.target.url,
    entities: targetEntities,
    chunks: targetChunks.map((chunk, i) => ({ ...chunk, vector: vectors[i] })),
    terms: termsOf(corpus.target.text),
    wordCount: Math.max(1, corpus.target.wordCount || targetChunks.reduce((sum, chunk) => sum + chunk.text.split(' ').length, 0)),
  };
  const docs: CompetitorDoc[] = corpus.pages.map((page, index) => ({
    url: page.url, rank: page.rank, fetchedAt: page.fetchedAt, status: page.status,
    entities: pageEntities[index], terms: termsOf(page.text),
    passages: pageChunks[index].map((chunk) => ({ text: chunk.text, vector: vectors[cursor++] })),
  }));
  const report = buildIgosReport(target, docs, buildBaseline(docs, corpus.requested));
  const identity = options.provider ?? (lexical ? LOCAL_PROVIDER_IDENTITY : { id: 'custom', model: 'unknown' });
  const provenance: IgosProvenance = {
    provider: identity.id, model: identity.model, runAt: (options.now ?? (() => new Date().toISOString()))(), targetUrl: corpus.target.url,
    docs: corpus.pages.map((page) => ({ url: page.url, rank: page.rank, fetchedAt: page.fetchedAt })),
  };
  return { ...report, provenance, limitations: [...report.limitations, ...(lexical ? [LOCAL_LEXICAL] : []), HEURISTIC_ENTITIES, ...(state.failed ? [OLLAMA_ENTITIES_UNAVAILABLE] : state.used ? [OLLAMA_ENTITIES] : [])] };
};
