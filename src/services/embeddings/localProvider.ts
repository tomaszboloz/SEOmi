import type { EmbeddingProvider, Vector } from './types.ts';
import { contentStems } from './text.ts';
import { normalize } from './vector.ts';
import { SEO_GLOSSARY, compileGlossary, type Glossary } from './glossary.ts';

export interface LocalHashOptions {
  /** Vector size. Larger values reduce hash collisions. */
  dimensions?: number;
  /** Character n-gram sizes taken from each stem (typo and inflection tolerance). */
  ngramSizes?: number[];
  /** Relative feature weights; tune these against an evaluation dataset. */
  weights?: { word: number; bigram: number; ngram: number; concept: number };
  /** Cross-language concept vocabulary; pass `{}` to disable. */
  glossary?: Glossary;
}

// FNV-1a, 32-bit: fast, stable across runs and platforms.
const hash = (value: string): number => {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
};

/**
 * Offline embedding by signed feature hashing of word stems, word bigrams and
 * character n-grams. Deterministic, needs no model download and works for any
 * language; an IDF fitted on the corpus down-weights features common to all texts.
 */
export const createLocalHashProvider = (options: LocalHashOptions = {}): EmbeddingProvider & { fit(corpus: string[]): void } => {
  const dimensions = options.dimensions ?? 1024;
  const ngramSizes = options.ngramSizes ?? [3, 4, 5];
  const weights = options.weights ?? { word: 1, bigram: 0.6, ngram: 0.35, concept: 2 };
  const glossary = compileGlossary(options.glossary ?? SEO_GLOSSARY);
  if (!Number.isInteger(dimensions) || dimensions < 16) throw new Error('dimensions must be an integer of at least 16');
  let idf: Float64Array | null = null;

  const features = (text: string): Map<number, number> => {
    const counts = new Map<number, number>();
    const add = (feature: string, weight: number) => {
      const bucket = hash(feature);
      const index = bucket % dimensions;
      const sign = bucket & 0x80000000 ? -1 : 1;
      counts.set(index, (counts.get(index) ?? 0) + sign * weight);
    };
    const stems = contentStems(text);
    for (const concept of glossary.concepts(stems)) add(`c:${concept}`, weights.concept);
    stems.forEach((word, position) => {
      add(`w:${word}`, weights.word);
      if (position > 0) add(`b:${stems[position - 1]}_${word}`, weights.bigram);
      const padded = `^${word}$`;
      for (const size of ngramSizes) {
        for (let start = 0; start + size <= padded.length; start += 1) add(`n${size}:${padded.slice(start, start + size)}`, weights.ngram);
      }
    });
    return counts;
  };

  const vectorize = (text: string): Vector => {
    const raw = new Float64Array(dimensions);
    for (const [index, value] of features(text)) {
      // Sub-linear term frequency keeps repeated words from dominating.
      raw[index] = Math.sign(value) * Math.log1p(Math.abs(value)) * (idf ? idf[index] : 1);
    }
    return normalize(raw);
  };

  return {
    id: 'local-hash',
    model: `hash-${dimensions}-n${ngramSizes.join('')}`,
    fit(corpus: string[]) {
      const frequency = new Float64Array(dimensions);
      for (const text of corpus) for (const index of features(text).keys()) frequency[index] += 1;
      idf = frequency.map((count) => Math.log((1 + corpus.length) / (1 + count)) + 1);
    },
    async embed(texts: string[]) {
      return texts.map(vectorize);
    },
  };
};
