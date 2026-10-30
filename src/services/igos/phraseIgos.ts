import { createLocalHashProvider } from '@/services/embeddings/localProvider';
import { contentStems } from '@/services/embeddings/text';
import type { Vector } from '@/services/embeddings/types';
import type { TopTenCorpus } from '@/services/targetPhraseAudit/types';
import { buildBaseline } from './baseline';
import { buildIgosReport, type IgosReport } from './report';
import type { CompetitorDoc, TargetDoc } from './types';

export const PHRASE_IGOS_PROFILE = { chunkWords: 60, maxChunks: 40, maxEntities: 80 } as const;
/** Limitation code: vectors come from the local lexical hash provider, not a semantic model. */
export const LOCAL_LEXICAL = 'local-lexical-embeddings';

export type Embed = (texts: string[]) => Promise<Vector[]>;

const localEmbed: Embed = async (texts) => {
  const provider = createLocalHashProvider();
  provider.fit(texts);
  return provider.embed(texts);
};

/** Fixed word windows with character offsets into the source text. */
export const chunkText = (text: string): Array<{ text: string; offset: number }> => {
  const words = [...text.matchAll(/\S+/gu)];
  const chunks: Array<{ text: string; offset: number }> = [];
  for (let i = 0; i < words.length && chunks.length < PHRASE_IGOS_PROFILE.maxChunks; i += PHRASE_IGOS_PROFILE.chunkWords) {
    const window = words.slice(i, i + PHRASE_IGOS_PROFILE.chunkWords);
    chunks.push({ text: window.map((match) => match[0]).join(' '), offset: window[0].index ?? 0 });
  }
  return chunks;
};

const termsOf = (text: string): Map<string, number> => {
  const terms = new Map<string, number>();
  contentStems(text).forEach((term) => terms.set(term, (terms.get(term) ?? 0) + 1));
  return terms;
};

const entitiesOf = (text: string): string[] => [...new Set(contentStems(text))].slice(0, PHRASE_IGOS_PROFILE.maxEntities);

/** IGOS for one phrase from the TOP 10 corpus actually fetched; null when the target page text is missing. */
export const buildPhraseIgos = async (corpus: TopTenCorpus, embed: Embed = localEmbed, lexical = embed === localEmbed): Promise<IgosReport | null> => {
  if (!corpus.target?.text.trim()) return null;
  const targetChunks = chunkText(corpus.target.text);
  const pageChunks = corpus.pages.map((page) => chunkText(page.text));
  const texts = [...targetChunks, ...pageChunks.flat()].map((chunk) => chunk.text);
  const vectors = texts.length ? await embed(texts) : [];
  if (vectors.length !== texts.length) return null;
  let cursor = targetChunks.length;
  const target: TargetDoc = {
    url: corpus.target.url,
    entities: entitiesOf(corpus.target.text),
    chunks: targetChunks.map((chunk, i) => ({ ...chunk, heading: null, vector: vectors[i] })),
    terms: termsOf(corpus.target.text),
    wordCount: Math.max(1, corpus.target.wordCount || targetChunks.reduce((sum, chunk) => sum + chunk.text.split(' ').length, 0)),
  };
  const docs: CompetitorDoc[] = corpus.pages.map((page, index) => ({
    url: page.url, rank: page.rank, fetchedAt: page.fetchedAt, status: page.status,
    entities: entitiesOf(page.text), terms: termsOf(page.text),
    passages: pageChunks[index].map((chunk) => ({ text: chunk.text, vector: vectors[cursor++] })),
  }));
  const report = buildIgosReport(target, docs, buildBaseline(docs, corpus.requested));
  return lexical ? { ...report, limitations: [...report.limitations, LOCAL_LEXICAL] } : report;
};
