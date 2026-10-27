import { isSemanticNoiseTerm, semanticTermKey } from '@/services/semanticText';

/** Sparse, L2-normalised term vector. */
export type Vec = Map<string, number>;
export interface Idf { chunks: number; df: Map<string, number> }

const WORD = /[\p{L}\p{N}]+/gu;
const MIN_ENTITY_CHARS = 4;

export const words = (text: string): string[] => (text.match(WORD) ?? []).map((word) => word.toLowerCase());

const keyed = (word: string, language: string): string | null =>
  word.length >= MIN_ENTITY_CHARS && !isSemanticNoiseTerm(word) ? semanticTermKey(word, language) : null;

/** Specialist terms of a text: stemmed unigrams and adjacent bigrams, key -> first surface form. */
export const entitiesOf = (text: string, language: string): Map<string, string> => {
  const found = new Map<string, string>();
  const list = words(text);
  list.forEach((word, index) => {
    const key = keyed(word, language);
    if (!key) return;
    if (!found.has(key)) found.set(key, word);
    const next = list[index + 1];
    const nextKey = next === undefined ? null : keyed(next, language);
    if (nextKey && !found.has(`${key} ${nextKey}`)) found.set(`${key} ${nextKey}`, `${word} ${next}`);
  });
  return found;
};

export const termCounts = (text: string, language: string): Map<string, number> => {
  const counts = new Map<string, number>();
  words(text).forEach((word) => {
    const key = keyed(word, language);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
};

export const buildIdf = (chunkCounts: Array<Map<string, number>>): Idf => {
  const df = new Map<string, number>();
  chunkCounts.forEach((counts) => counts.forEach((_, key) => df.set(key, (df.get(key) ?? 0) + 1)));
  return { chunks: chunkCounts.length, df };
};

const normalize = (vec: Vec): Vec => {
  let sum = 0;
  vec.forEach((value) => { sum += value * value; });
  const norm = Math.sqrt(sum);
  if (norm > 0) vec.forEach((value, key) => vec.set(key, value / norm));
  return vec;
};

export const vectorize = (counts: Map<string, number>, idf: Idf): Vec => {
  const vec: Vec = new Map();
  counts.forEach((count, key) => vec.set(key, (1 + Math.log(count)) * Math.log(1 + idf.chunks / (1 + (idf.df.get(key) ?? 0)))));
  return normalize(vec);
};

export const centroidOf = (vectors: Vec[]): Vec => {
  const sum: Vec = new Map();
  vectors.forEach((vec) => vec.forEach((value, key) => sum.set(key, (sum.get(key) ?? 0) + value)));
  return normalize(sum);
};

/** Cosine of two normalised vectors. */
export const cosine = (left: Vec, right: Vec): number => {
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let dot = 0;
  small.forEach((value, key) => { dot += value * (large.get(key) ?? 0); });
  return dot;
};
