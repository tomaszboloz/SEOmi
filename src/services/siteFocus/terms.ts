import { getDomainWithoutSuffix } from 'tldts';
import { isSemanticNoiseTerm, semanticPageLanguage, semanticTermKey } from '@/services/semanticText';
import type { FocusPage, FocusTerm } from './types';

/** Zone weights: title and H1 count most, H2/H3 next, body text once. */
export const ZONE_WEIGHT = { title: 2.5, h1: 2.5, h2: 1.5, h3: 1.5, body: 1 } as const;

export interface TermEntry { key: string; surface: string; count: number; tf: number }
export interface PageTerms {
  url: string;
  language: string;
  degraded: boolean;
  entries: Map<string, TermEntry>;
  /** Unigram key -> keys of the words it is paired with in bigrams on this page (polysemy guard). */
  neighbors: Map<string, Set<string>>;
}
export interface TermStats { pageCount: number; documentFrequency: Map<string, number> }

const WORD = /[\p{L}\p{N}]+/gu;

const tokens = (text: string): string[] => (text.match(WORD) ?? []).map((word) => word.toLowerCase());

const keyOf = (words: string[], language: string): string => words.map((word) => semanticTermKey(word, language)).join(' ');

/** Key for a free-text phrase, or null if it is only noise. */
export const phraseKey = (phrase: string, language: string): string | null => {
  const words = tokens(phrase).filter((word) => !isSemanticNoiseTerm(word));
  return words.length ? keyOf(words, language) : null;
};

/** The site's own name: it describes the site, never a topic within it. */
export const brandKeys = (startUrl: string, language: string): Set<string> => {
  const host = (() => {
    try {
      return getDomainWithoutSuffix(new URL(startUrl).hostname, { allowPrivateDomains: true }) ?? '';
    } catch {
      return '';
    }
  })();
  return new Set(host.split('.').filter((part) => part.length > 3).map((part) => semanticTermKey(part, language)));
};

const add = (entries: Map<string, TermEntry>, key: string, surface: string, count: number, tf: number): void => {
  const current = entries.get(key);
  if (current) {
    current.count += count;
    current.tf += tf;
  } else entries.set(key, { key, surface, count, tf });
};

/** Unigrams and bigrams of a text, weighted by zone. */
const addText = (entries: Map<string, TermEntry>, text: string, zone: number, language: string): void => {
  const words = tokens(text);
  words.forEach((word, index) => {
    if (isSemanticNoiseTerm(word)) return;
    add(entries, keyOf([word], language), word, 1, zone);
    const next = words[index + 1];
    if (next !== undefined && !isSemanticNoiseTerm(next)) add(entries, keyOf([word, next], language), `${word} ${next}`, 1, zone);
  });
};

const neighborMap = (entries: Map<string, TermEntry>): Map<string, Set<string>> => {
  const neighbors = new Map<string, Set<string>>();
  entries.forEach((entry) => {
    const parts = entry.key.split(' ');
    if (parts.length !== 2) return;
    parts.forEach((part, index) => {
      const set = neighbors.get(part) ?? new Set<string>();
      set.add(parts[1 - index]);
      neighbors.set(part, set);
    });
  });
  return neighbors;
};

const fromFocusTerms = (focusTerms: FocusTerm[], language: string, entries: Map<string, TermEntry>): void => {
  focusTerms.forEach((item) => {
    const key = phraseKey(item.term, language);
    if (!key) return;
    const count = Math.max(1, item.count || 1);
    add(entries, key, (item.surface || item.term).toLowerCase(), count, item.weight > 0 ? item.weight : count);
  });
};

const fromFallback = (page: FocusPage, language: string, entries: Map<string, TermEntry>): void => {
  const headings = page.heading_texts;
  addText(entries, page.title ?? '', ZONE_WEIGHT.title, language);
  (headings?.h1 ?? []).forEach((text) => addText(entries, text, ZONE_WEIGHT.h1, language));
  [...(headings?.h2 ?? []), ...(headings?.h3 ?? [])].forEach((text) => addText(entries, text, ZONE_WEIGHT.h2, language));
  addText(entries, page.meta_description ?? '', ZONE_WEIGHT.body, language);
  (page.semantic_excerpts ?? []).forEach((text) => addText(entries, text, ZONE_WEIGHT.body, language));
  (page.semantic_terms ?? []).forEach((term) => {
    const key = phraseKey(term, language);
    if (key) add(entries, key, term.toLowerCase(), 1, ZONE_WEIGHT.body);
  });
  (page.content_terms ?? []).forEach((item) => {
    const key = phraseKey(item.term, language);
    if (key) add(entries, key, item.term.toLowerCase(), item.count, item.count);
  });
};

/** Extracts a page's zone-weighted terms; falls back to titles/excerpts/semantic terms and marks the page degraded. */
export const extractPageTerms = (page: FocusPage, language: string | undefined, brand: Set<string>): PageTerms => {
  const lang = language ?? semanticPageLanguage(page) ?? '';
  const entries = new Map<string, TermEntry>();
  const focusTerms = page.focus_terms ?? [];
  const degraded = !focusTerms.length;
  if (degraded) fromFallback(page, lang, entries);
  else fromFocusTerms(focusTerms, lang, entries);
  [...entries.keys()].forEach((key) => {
    if (key.split(' ').some((part) => brand.has(part))) entries.delete(key);
  });
  return { url: page.url, language: lang, degraded, entries, neighbors: neighborMap(entries) };
};

export const buildTermStats = (pages: PageTerms[]): TermStats => {
  const documentFrequency = new Map<string, number>();
  pages.forEach((page) => page.entries.forEach((_, key) => documentFrequency.set(key, (documentFrequency.get(key) ?? 0) + 1)));
  return { pageCount: pages.length, documentFrequency };
};

/** idf = ln(1 + N/df): never zero, so a term present on every page still carries weight. */
export const idf = (stats: TermStats, key: string): number =>
  Math.log(1 + Math.max(1, stats.pageCount) / (stats.documentFrequency.get(key) ?? 1));

/** TF-IDF vector with sublinear tf. */
export const tfidfVector = (page: PageTerms, stats: TermStats): Map<string, number> => {
  const vector = new Map<string, number>();
  page.entries.forEach((entry, key) => vector.set(key, (1 + Math.log(Math.max(1, entry.tf))) * idf(stats, key)));
  return vector;
};
