import { extractValues, sentencesOf } from './ymylValues';

/**
 * Term dictionary for the YMYL fact gate (#137). SEOmi ships no MeSH/ICD-10 data (licence and source are
 * the user's decision); the user imports a plain list or CSV they are entitled to use, e.g. drug names or
 * ICD-10 codes with labels. Matching is whole-word and case-insensitive, Unicode-aware.
 */
export interface TermDictionary {
  /** Lower-case terms (labels and codes). */
  terms: ReadonlySet<string>;
  source: string;
  importedAt: string;
}

export const MAX_DICTIONARY_TERMS = 20_000;
const MAX_TERM_CHARS = 120;

export interface DictionaryParse { dictionary: TermDictionary | null; rejected: number; truncated: boolean }

/** One entry per line; CSV/TSV/semicolon cells are all terms (e.g. `E11;Type 2 diabetes`). `#` starts a comment. */
export const parseTermDictionary = (text: string, source: string, importedAt: string): DictionaryParse => {
  const terms = new Set<string>();
  let rejected = 0;
  let truncated = false;
  for (const line of text.replace(/^\uFEFF/u, '').split(/\r?\n/u)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    for (const cell of line.split(/[,;\t]/u)) {
      const term = cell.trim().replace(/^"|"$/gu, '').trim().toLocaleLowerCase();
      if (!term) continue;
      if (term.length < 2 || term.length > MAX_TERM_CHARS || /^\d+([.,]\d+)?$/u.test(term)) { rejected += 1; continue; }
      if (terms.size >= MAX_DICTIONARY_TERMS) { truncated = true; break; }
      terms.add(term);
    }
  }
  return { dictionary: terms.size ? { terms, source, importedAt } : null, rejected, truncated };
};

const WORD = /[\p{L}\p{N}][\p{L}\p{N}.-]*/gu;

/** Dictionary terms named in the text (single words and phrases up to four words). */
export const mentionedTerms = (text: string, dictionary: TermDictionary): string[] => {
  const words = [...text.toLocaleLowerCase().matchAll(WORD)].map((match) => match[0].replace(/[.-]+$/u, ''));
  const found = new Set<string>();
  for (let start = 0; start < words.length; start += 1) {
    for (let size = 1; size <= 4 && start + size <= words.length; size += 1) {
      const phrase = words.slice(start, start + size).join(' ');
      if (dictionary.terms.has(phrase)) found.add(phrase);
    }
  }
  return [...found];
};

/** Values that some source sentence states next to one of the given terms. */
export const boundValues = (sources: string[], terms: string[], dictionary: TermDictionary): Set<string> => {
  const wanted = new Set(terms);
  const values = new Set<string>();
  sources.flatMap(sentencesOf).forEach((sentence) => {
    if (mentionedTerms(sentence, dictionary).some((term) => wanted.has(term))) extractValues(sentence).forEach((value) => values.add(value));
  });
  return values;
};
