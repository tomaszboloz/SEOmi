import { contextTokens } from './text';

export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

export const responseSentences = (value: string): SentenceSpan[] => {
  const sentences: SentenceSpan[] = [];
  const matcher = /[^.!?\n]+/gu;
  for (const match of value.matchAll(matcher)) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (!trimmed || contextTokens(trimmed).length < 3) continue;
    const rawStart = match.index;
    const start = rawStart + raw.indexOf(trimmed);
    sentences.push({ text: trimmed, start, end: start + trimmed.length });
    if (sentences.length >= 30) break;
  }
  return sentences;
};

export interface SentenceMatch extends SentenceSpan {
  excerpt: string;
  overlap: number;
  matchedTerms: string[];
  sourceStart: number;
  sourceEnd: number;
}

export const bestSentenceMatch = (responseText: string, excerpts: string[]): SentenceMatch | null => {
  let best: SentenceMatch | null = null;
  for (const sentence of responseSentences(responseText)) {
    const sentenceTerms = new Set(contextTokens(sentence.text));
    for (const excerpt of excerpts) {
      const excerptTerms = new Set(contextTokens(excerpt));
      // responseSentences retained at least three sentence tokens.
      if (!excerptTerms.size) continue;
      const shared = [...sentenceTerms].filter((term) => excerptTerms.has(term));
      const union = new Set([...sentenceTerms, ...excerptTerms]);
      const overlap = shared.length / union.size;
      // This is an intentionally conservative lexical threshold. It is not
      // a semantic entailment or plagiarism detector.
      if (shared.length < 3 || overlap < 0.35 || (best && overlap <= best.overlap)) continue;
      best = {
        ...sentence,
        excerpt,
        overlap,
        matchedTerms: shared.slice(0, 12),
        sourceStart: 0,
        sourceEnd: excerpt.length,
      };
    }
  }
  return best;
};
