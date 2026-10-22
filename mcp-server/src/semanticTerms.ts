import { SEMANTIC_STOPWORDS } from './semanticStopwords.js';

/** Mirrors `normalizeSemanticText` in src/services/semanticText.ts (diacritic folding). */
export const normalizeSemanticText = (value: string): string => value
  .normalize('NFKC')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[łŁ]/g, 'l')
  .replace(/[đĐ]/g, 'd')
  .replace(/[Ħħ]/g, 'h')
  .replace(/[Ĵĵ]/g, 'j')
  .replace(/[Ķķ]/g, 'k')
  .replace(/[Ŧŧ]/g, 't')
  .replace(/[Ŵŵ]/g, 'w')
  .replace(/[ßẞ]/g, 'ss')
  .replace(/[øØ]/g, 'o')
  .replace(/[æÆ]/g, 'ae')
  .replace(/[œŒ]/g, 'oe')
  .toLowerCase()
  .trim();

const STOPWORDS = new Set(
  [SEMANTIC_STOPWORDS.pl, SEMANTIC_STOPWORDS.en].flat().map((word) => normalizeSemanticText(word)),
);

/** Mirrors `isSemanticNoiseTerm` in the app: function words, chrome and mostly-digit tokens. */
export const isSemanticNoiseTerm = (term: string): boolean => {
  const folded = normalizeSemanticText(term);
  if (STOPWORDS.has(folded)) return true;
  const letters = folded.match(/\p{L}/gu)?.length ?? 0;
  const digits = folded.match(/\p{N}/gu)?.length ?? 0;
  return letters < 2 || digits >= letters;
};

/** Counts topical tokens; surface forms that fold to the same text are merged under the first seen. */
export const countSemanticTerms = (text: string): Map<string, number> => {
  const counts = new Map<string, number>();
  const surfaces = new Map<string, string>();
  for (const raw of text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) || []) {
    if (isSemanticNoiseTerm(raw)) continue;
    const key = normalizeSemanticText(raw);
    const surface = surfaces.get(key) ?? raw;
    surfaces.set(key, surface);
    counts.set(surface, (counts.get(surface) || 0) + 1);
  }
  return counts;
};
