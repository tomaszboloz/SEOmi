import type { CrawledPageSummary } from '@/types';
import { semanticPageTermEntries } from '@/services/semanticText';

const MAX_TERMS_PER_PAGE = 40;
const MIN_PAGES_FOR_FREQUENCY_CEILING = 10;
const MAX_TOPIC_TERM_DOCUMENT_SHARE = 0.5;

export interface SemanticTermInventory {
  /** Inflection keys per page, ordered by the crawler's in-page frequency, so the index doubles as salience rank. */
  termsByPage: string[][];
  /** Page keys without the terms that describe the whole site rather than a topic within it. */
  topicalTermsByPage: Array<Set<string>>;
  isTopicalTerm: (key: string) => boolean;
  inverseFrequency: (key: string) => number;
  /** The most common observed form of a key, with diacritics, for display. */
  displayTerm: (key: string) => string;
}

export const buildTermInventory = (selectedPages: CrawledPageSummary[]): SemanticTermInventory => {
  const surfaceForms = new Map<string, Map<string, number>>();
  // One filtered, language-keyed inventory shared with every evidence consumer.
  const termsByPage = selectedPages.map((page) => semanticPageTermEntries(page, MAX_TERMS_PER_PAGE).map(({ key, surface }) => {
    const forms = surfaceForms.get(key) ?? new Map<string, number>();
    forms.set(surface, (forms.get(surface) ?? 0) + 1);
    surfaceForms.set(key, forms);
    return key;
  }));
  // The most common observed form of each key; ties prefer the shorter form.
  const displayForms = new Map([...surfaceForms].map(([key, forms]) => [key, [...forms]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1))[0][0]]));
  const documentFrequency = new Map<string, number>();
  termsByPage.forEach((terms) => terms.forEach((term) => documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)));
  const comparablePages = Math.max(1, termsByPage.filter((terms) => terms.length > 0).length);
  // A term on a large share of a site (brand, main product) describes the site,
  // not a topic within it. On tiny crawls document frequency says little, so
  // the ceiling only applies once enough pages carry terms.
  // Every key these helpers receive came from the inventory built above.
  const isTopicalTerm = (key: string) => comparablePages < MIN_PAGES_FOR_FREQUENCY_CEILING
    || documentFrequency.get(key)! / comparablePages <= MAX_TOPIC_TERM_DOCUMENT_SHARE;
  return {
    termsByPage,
    topicalTermsByPage: termsByPage.map((terms) => new Set(terms.filter(isTopicalTerm))),
    isTopicalTerm,
    inverseFrequency: (key) => Math.log(1 + comparablePages / documentFrequency.get(key)!),
    displayTerm: (key) => displayForms.get(key)!,
  };
};
