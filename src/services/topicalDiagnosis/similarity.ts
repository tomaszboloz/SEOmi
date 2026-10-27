import { semanticTermIdentity } from '@/services/semanticText';
import { getDomainWithoutSuffix } from 'tldts';
import type { DiagnosisDocument } from './types';
import { BRAND_TOKEN_PATTERN, MIN_DOCUMENTS_FOR_CEILING, SITE_WIDE_TERM_SHARE } from './thresholds';

export interface TermStatistics {
  documentFrequency: Map<string, number>;
  /** Content documents with at least one term. */
  comparable: number;
  isTopical: (key: string) => boolean;
  idf: (key: string) => number;
}

const localPart = (key: string): string => key.slice(key.indexOf(':') + 1);

/** The site's own name in every language namespace: it describes the site, never a topic within it. */
export const brandKeysFor = (startUrl: string, documents: DiagnosisDocument[]): Set<string> => {
  const host = (() => {
    try {
      return getDomainWithoutSuffix(new URL(startUrl).hostname, { allowPrivateDomains: true }) ?? '';
    } catch {
      return '';
    }
  })();
  const tokens = host.split('.').filter((part) => part.length > 3);
  const languages = new Set(documents.flatMap((document) => (document.languages.length ? document.languages : ['und'])));
  const keys = new Set<string>();
  languages.forEach((language) => tokens.forEach((token) => keys.add(semanticTermIdentity(token, language))));
  return keys;
};

export const buildTermStatistics = (documents: DiagnosisDocument[], brandKeys: Set<string>): TermStatistics => {
  const content = documents.filter((document) => document.role === 'content' && document.terms.size > 0);
  const documentFrequency = new Map<string, number>();
  content.forEach((document) => document.terms.forEach((key) => documentFrequency.set(key, (documentFrequency.get(key) ?? 0) + 1)));
  const comparable = Math.max(1, content.length);
  const isBrand = (key: string) => brandKeys.has(key) || BRAND_TOKEN_PATTERN.test(localPart(key));
  // On tiny sites document frequency says nothing, so the site-wide ceiling waits for enough documents.
  const isTopical = (key: string) => !isBrand(key)
    && (content.length < MIN_DOCUMENTS_FOR_CEILING || (documentFrequency.get(key) ?? 0) / comparable <= SITE_WIDE_TERM_SHARE);
  return {
    documentFrequency,
    comparable,
    isTopical,
    idf: (key) => Math.log(1 + comparable / (documentFrequency.get(key) ?? 1)),
  };
};

export const topicalTerms = (document: DiagnosisDocument, stats: TermStatistics): Set<string> =>
  new Set([...document.terms].filter(stats.isTopical));

/** IDF-weighted Jaccard: rare shared terms count more than common ones. */
export const weightedJaccard = (
  left: Set<string>, right: Set<string>, idf: (key: string) => number,
): { similarity: number; shared: string[] } => {
  let intersection = 0;
  let union = 0;
  const shared: string[] = [];
  new Set([...left, ...right]).forEach((key) => {
    const weight = idf(key);
    union += weight;
    if (left.has(key) && right.has(key)) {
      intersection += weight;
      shared.push(key);
    }
  });
  return { similarity: union ? intersection / union : 0, shared: shared.sort() };
};

/**
 * The shared keys of the one language that shares the most. Keys are
 * namespaced by language, so two bilingual documents repeat every shared word
 * once per version; a threshold on shared words must not count it twice.
 */
export const sharedInOneLanguage = (keys: string[]): string[] => {
  const byLanguage = new Map<string, string[]>();
  keys.forEach((key) => {
    const language = key.slice(0, key.indexOf(':'));
    byLanguage.set(language, [...(byLanguage.get(language) ?? []), key]);
  });
  return [...byLanguage.values()].reduce<string[]>((best, group) => (group.length > best.length ? group : best), []);
};
