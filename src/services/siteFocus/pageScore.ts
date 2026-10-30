import { idf, type PageTerms, type TermStats } from './terms';
import type { AlignmentRow, FallbackMode } from './types';

const OVERLAP_SATURATION = 12;
const round1 = (value: number): number => Math.round(value * 10) / 10;

/** What the scorer needs to know about the site; also the serializable shape of SiteFocusModel. */
export interface ScoringModel {
  termCluster: Map<string, string>;
  coreClusterId: string;
  coreWeights: Map<string, number>;
  kCore: string[];
}

export interface PageScoreParts {
  trs: number;
  similarity: number;
  keywordOverlap: number;
  semanticDrift: number;
  /** TF-IDF mass per foreign cluster id, counted toward drift. */
  foreignMass: Map<string, number>;
  /** Clustered page terms with their TF-IDF weight. */
  weights: Map<string, number>;
}

export const cosineMaps = (left: Map<string, number>, right: Map<string, number>): number => {
  let dot = 0;
  let a = 0;
  left.forEach((value, key) => { a += value * value; dot += value * (right.get(key) ?? 0); });
  let b = 0;
  right.forEach((value) => { b += value * value; });
  return a > 0 && b > 0 ? dot / Math.sqrt(a * b) : 0;
};

/**
 * Polysemy guard: a foreign-cluster word that is paired, in a bigram on this very page,
 * with a Core Topic word is read in the core sense and does not count as drift.
 */
const isGuarded = (key: string, page: PageTerms, model: ScoringModel): boolean => {
  const near = page.neighbors.get(key);
  return !!near && [...near].some((other) => model.termCluster.get(other) === model.coreClusterId);
};

export const scorePage = (page: PageTerms, stats: TermStats, model: ScoringModel, mode: FallbackMode): PageScoreParts => {
  const weights = new Map<string, number>();
  const foreignMass = new Map<string, number>();
  const coreVector = new Map<string, number>();
  let total = 0;
  let foreignTotal = 0;
  let tfTotal = 0;
  let tfForeign = 0;
  page.entries.forEach((entry, key) => {
    const cluster = model.termCluster.get(key);
    if (cluster === undefined) return;
    const weight = (1 + Math.log(Math.max(1, entry.tf))) * idf(stats, key);
    weights.set(key, weight);
    total += weight;
    tfTotal += entry.tf;
    if (cluster === model.coreClusterId) {
      coreVector.set(key, weight);
      return;
    }
    if (isGuarded(key, page, model)) return;
    foreignTotal += weight;
    tfForeign += entry.tf;
    foreignMass.set(cluster, (foreignMass.get(cluster) ?? 0) + weight);
  });
  const similarity = cosineMaps(weights, model.coreWeights);
  const present = model.kCore.filter((key) => page.entries.has(key)).length;
  const overlap = Math.min(1, present / Math.min(Math.max(1, model.kCore.length), OVERLAP_SATURATION));
  const drift = total > 0 ? foreignTotal / total : 0;
  const lexicalDrift = tfTotal > 0 ? tfForeign / tfTotal : 0;
  const raw = mode !== 'lexical' ? 0.5 * similarity + 0.3 * overlap - 0.2 * drift : 0.75 * overlap - 0.25 * lexicalDrift;
  return {
    trs: round1(Math.max(0, Math.min(100, raw * 125))),
    similarity: round1(similarity * 100),
    keywordOverlap: round1(overlap * 100),
    semanticDrift: round1((mode !== 'lexical' ? drift : lexicalDrift) * 100),
    foreignMass, weights,
  };
};

export const alignmentLevel = (relevancePct: number): AlignmentRow['level'] =>
  relevancePct > 70 ? 'strong' : relevancePct >= 40 ? 'moderate' : 'weak';
