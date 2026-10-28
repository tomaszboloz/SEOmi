import type { CrawledPageSummary } from '@/types';

export interface InjectionSection { heading: string; level: 2 | 3; index: number; termHits: number; matchedTerms: string[] }

/** Scripts written without spaces between words: whole-word boundaries do not apply. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Literal, case-insensitive occurrences; Latin/Cyrillic/Arabic terms must stand as whole words. */
export const countTerm = (text: string, term: string): number => {
  const needle = term.trim();
  if (!needle) return 0;
  const body = escapeRegExp(needle);
  const pattern = UNSPACED.test(needle) ? body : `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`;
  return text.match(new RegExp(pattern, 'giu'))?.length ?? 0;
};

/**
 * H2/H3 section of the donor page with the most shared-term occurrences (heading plus paragraphs).
 * Ties keep the earlier section. Pages without captured sections give null: no location is guessed.
 */
export const bestSection = (page: CrawledPageSummary, terms: readonly string[]): InjectionSection | null => {
  let best: InjectionSection | null = null;
  (page.rag_sections ?? []).forEach((section, index) => {
    if (section.level !== 2 && section.level !== 3) return;
    const text = [section.heading, ...section.paragraphs].join('\n');
    const counts = terms.map((term) => [term, countTerm(text, term)] as const).filter(([, count]) => count > 0);
    const termHits = counts.reduce((sum, [, count]) => sum + count, 0);
    if (termHits && (!best || termHits > best.termHits)) {
      best = { heading: section.heading, level: section.level, index, termHits, matchedTerms: counts.map(([term]) => term) };
    }
  });
  return best;
};
