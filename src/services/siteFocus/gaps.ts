import { clusterTerms } from './cluster';
import { phraseKey } from './terms';
import { brandReason, type BrandPolicy } from './brandPolicy';
import type { Prepared } from './evaluate';
import type { BrandFilterReport, TopicGap } from './types';

const SUBTOPIC_CUT = 0.35;
const CORE_TERMS_CONSIDERED = 60;
const THIN_COVERAGE_PCT = 15;
const MAX_GAPS = 10;
const MAX_COMPETITOR_TERMS = 20;
const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Topic Cluster Gap Analysis. Sub-topics are the finer co-occurrence groups inside the Core Topic cluster;
 * a sub-topic present on few pages is thin. Competitor terms the site never uses are reported as one gap.
 */
export const analyzeGaps = (
  items: Prepared[], vectors: Map<string, number>[], coreKeys: string[], totals: Map<string, number>,
  surfaces: Map<string, string>, competitorTerms: string[], language: string, brand?: BrandPolicy,
  filtered: BrandFilterReport['filteredGaps'] = [],
): TopicGap[] => {
  const live = items.filter((item) => !item.skipped);
  const terms = coreKeys.slice(0, CORE_TERMS_CONSIDERED).map((key) => ({ key, weight: totals.get(key) ?? 0 }));
  const gaps: TopicGap[] = [];
  if (live.length) {
    clusterTerms(terms, vectors, { cut: SUBTOPIC_CUT }).clusters.forEach((cluster) => {
      const need = Math.min(2, cluster.keys.length);
      const covering = live.filter((item) => cluster.keys.filter((key) => item.terms.entries.has(key)).length >= need).length;
      const coveragePct = round1((covering / live.length) * 100);
      if (coveragePct < THIN_COVERAGE_PCT) {
        gaps.push({
          code: 'thin-subtopic', label: cluster.keys.slice(0, 3).map((key) => surfaces.get(key) ?? key).join(', '),
          terms: cluster.keys.slice(0, 8).map((key) => surfaces.get(key) ?? key), coveragePct, pagesCovering: covering,
        });
      }
    });
  }
  gaps.sort((a, b) => a.coveragePct - b.coveragePct || (a.label < b.label ? -1 : 1));
  // Brand-navigational noise (#56) is moved to `filtered` with its reason instead of shown as a gap.
  const missing = [...new Set(competitorTerms.map((term) => term.trim()).filter(Boolean))].sort().filter((term) => {
    const key = phraseKey(term, language);
    if (!key) return false;
    const reason = brand ? brandReason(key, brand) : undefined;
    if (reason) filtered.push({ term, reason });
    return !reason && !totals.has(key);
  }).slice(0, MAX_COMPETITOR_TERMS);
  const result = gaps.slice(0, MAX_GAPS);
  if (missing.length) result.push({ code: 'competitor-terms', label: missing[0], terms: missing, coveragePct: 0, pagesCovering: 0 });
  return result;
};
