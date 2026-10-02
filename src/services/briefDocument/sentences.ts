import { evidenceTokens } from './primitives';

interface BriefSentenceSpan {
  text: string;
  start: number;
  end: number;
}

export const briefSentenceSpans = (value: string): BriefSentenceSpan[] => {
  const sentences: BriefSentenceSpan[] = [];
  for (const match of value.matchAll(/[^.!?\n]+/gu)) {
    const raw = match[0];
    const text = raw.trim();
    if (!text || evidenceTokens(text).length < 3) continue;
    const rawStart = match.index!;
    const start = rawStart + raw.indexOf(text);
    sentences.push({ text, start, end: start + text.length });
    if (sentences.length >= 30) break;
  }
  return sentences;
};

interface BriefSentenceMatch extends BriefSentenceSpan {
  excerpt: string;
  overlap: number;
  matchedTerms: string[];
}

export const bestBriefSentenceMatch = (paragraph: string, excerpts: string[]): BriefSentenceMatch | null => {
  let best: BriefSentenceMatch | null = null;
  for (const sentence of briefSentenceSpans(paragraph)) {
    const sentenceTerms = new Set(evidenceTokens(sentence.text));
    for (const excerpt of excerpts) {
      const excerptTerms = new Set(evidenceTokens(excerpt));
      if (!excerptTerms.size) continue;
      const matchedTerms = [...sentenceTerms].filter((term) => excerptTerms.has(term));
      const union = new Set([...sentenceTerms, ...excerptTerms]);
      const overlap = matchedTerms.length / union.size;
      if (matchedTerms.length < 3 || overlap < 0.35 || (best && overlap <= best.overlap)) continue;
      best = { ...sentence, excerpt, overlap, matchedTerms: matchedTerms.slice(0, 12) };
    }
  }
  return best;
};
