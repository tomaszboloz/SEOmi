import type { CrawledPageSummary } from '@/types';

/**
 * Section view used by sentence/H2-level hints (#127). Derived from the crawler's existing `rag_sections`
 * (AIO-R) instead of a second Rust extractor, so the crawl payload is not duplicated.
 * Decision (default chosen by agent): `semantic_sections` is this TS projection, not a new crawl field.
 */
export interface SemanticSection {
  /** Position in `rag_sections`; stable for one crawl. */
  index: number;
  heading: string;
  level: number;
  paragraphs: string[];
  firstSentence: string;
  wordCount: number;
  /** Most frequent words of the section (heading + paragraphs), 4+ letters, max 8. */
  terms: string[];
  hasTable: boolean;
  hasList: boolean;
}

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const words = (text: string): string[] => text.match(WORD) ?? [];

/** First sentence ends at . ! ? (or their CJK/Arabic forms) followed by space or end; falls back to the whole paragraph. */
export const firstSentenceOf = (text: string): string => {
  const trimmed = text.trim();
  const match = trimmed.match(/^.+?[.!?。！？؟](?=\s|$)/su);
  return (match ? match[0] : trimmed).trim();
};

const topTerms = (text: string): string[] => {
  const counts = new Map<string, number>();
  for (const word of words(text.toLocaleLowerCase())) if ([...word].length >= 4) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8).map(([term]) => term);
};

export const semanticSections = (page: Pick<CrawledPageSummary, 'rag_sections'>): SemanticSection[] =>
  (page.rag_sections ?? []).map((section, index) => {
    const paragraphs = section.paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean);
    const body = paragraphs.join('\n');
    return {
      index,
      heading: section.heading.trim(),
      level: section.level,
      paragraphs,
      firstSentence: paragraphs.length ? firstSentenceOf(paragraphs[0]) : '',
      wordCount: words(body).length,
      terms: topTerms(`${section.heading}\n${body}`),
      hasTable: section.tables > 0,
      hasList: section.ordered_lists + section.unordered_lists + section.definition_lists > 0,
    };
  });
