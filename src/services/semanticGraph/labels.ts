import i18n from '@/i18n';
import type { SemanticTermInventory } from './terms';

/**
 * Characteristic terms: shared by the members, salient on each page and rare
 * across the site. The most frequent term is usually the site's own subject.
 */
export const clusterLabel = (members: number[], inventory: SemanticTermInventory): string => {
  const { termsByPage, topicalTermsByPage, inverseFrequency, displayTerm } = inventory;
  const coverage = new Map<string, number>();
  const salience = new Map<string, number>();
  // Labels must use the same site-wide ceiling as the cluster edges. Falling
  // back to every observed term would re-introduce a filtered brand or chrome
  // term when a page has no remaining topical signals.
  members.forEach((index) => topicalTermsByPage[index].forEach((term) => {
    coverage.set(term, (coverage.get(term) ?? 0) + 1);
    salience.set(term, (salience.get(term) ?? 0) + 1 / (1 + termsByPage[index].indexOf(term) / 8));
  }));
  const score = (term: string) => (coverage.get(term)! / members.length) * salience.get(term)! * inverseFrequency(term);
  const minimumCoverage = members.length > 1 ? 2 : 1;
  const labelKeys = [...coverage.entries()]
    .filter(([, count]) => count >= minimumCoverage)
    .map(([term]) => term)
    .sort((a, b) => score(b) - score(a) || a.localeCompare(b))
    .slice(0, 2);
  return labelKeys.length
    ? labelKeys.map(displayTerm).join(' / ')
    : i18n.t('runtimeErrors.semanticMap.noSignals');
};
