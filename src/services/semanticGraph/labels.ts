import i18n from '@/i18n';
import type { SemanticTermInventory } from './terms';

/**
 * Characteristic terms: shared by the members, salient on each page and rare
 * across the site. The most frequent term is usually the site's own subject.
 */
export const clusterLabel = (members: number[], inventory: SemanticTermInventory): string => {
  const { termsByPage, isTopicalTerm, inverseFrequency, displayTerm } = inventory;
  const coverage = new Map<string, number>();
  const salience = new Map<string, number>();
  const labelTerms = (index: number) => {
    const topical = termsByPage[index].filter(isTopicalTerm);
    return topical.length ? topical : termsByPage[index];
  };
  members.forEach((index) => labelTerms(index).forEach((term) => {
    coverage.set(term, (coverage.get(term) ?? 0) + 1);
    salience.set(term, (salience.get(term) ?? 0) + 1 / (1 + termsByPage[index].indexOf(term) / 8));
  }));
  const score = (term: string) => (coverage.get(term)! / members.length) * salience.get(term)! * inverseFrequency(term);
  const labelKeys = [...coverage.keys()].sort((a, b) => score(b) - score(a) || a.localeCompare(b)).slice(0, 2);
  return labelKeys.length
    ? labelKeys.map(displayTerm).join(' / ')
    : i18n.t('runtimeErrors.semanticMap.noSignals');
};
