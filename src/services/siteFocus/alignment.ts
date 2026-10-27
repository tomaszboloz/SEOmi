import { alignmentLevel, type PageScoreParts, type ScoringModel } from './pageScore';
import type { PageTerms } from './terms';
import type { AlignmentRow, FocusPage, ForeignCluster, KeywordFound, OffTopicKeyword } from './types';

const SHOWN = 10;
const MATRIX_ROWS = 20;
const CONTEXT_CHARS = 120;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export interface PageDetails {
  keywordsFound: KeywordFound[];
  offTopicKeywords: OffTopicKeyword[];
  foreignClusters: ForeignCluster[];
  alignment: AlignmentRow[];
}

const contextFor = (surface: string, excerpts: string[]): string | undefined => {
  const excerpt = excerpts.find((text) => text.toLowerCase().includes(surface));
  return excerpt ? excerpt.trim().slice(0, CONTEXT_CHARS) : undefined;
};

/**
 * Keyword Alignment Matrix row: relevance of a term to the Core Topic.
 * Core terms scale with their site weight (45-100), foreign cluster terms are 15, tail terms 30.
 */
export const relevanceOf = (key: string, model: ScoringModel, maxCore: number): number => {
  const cluster = model.termCluster.get(key);
  if (cluster === model.coreClusterId) {
    return Math.round(Math.max(45, Math.sqrt((model.coreWeights.get(key) ?? 0) / Math.max(maxCore, 1e-9)) * 100));
  }
  return cluster === undefined ? 30 : 15;
};

export const buildPageDetails = (
  page: PageTerms, parts: PageScoreParts, model: ScoringModel, surfaces: Map<string, string>,
  labels: Map<string, string>, source: FocusPage,
): PageDetails => {
  const keys = [...parts.weights].sort(([ka, a], [kb, b]) => b - a || (ka < kb ? -1 : 1)).map(([key]) => key);
  const surface = (key: string) => surfaces.get(key) ?? page.entries.get(key)?.surface ?? key;
  const count = (key: string) => page.entries.get(key)?.count ?? 0;
  const excerpts = source.semantic_excerpts ?? [];
  const core = keys.filter((key) => model.termCluster.get(key) === model.coreClusterId);
  const foreign = keys.filter((key) => model.termCluster.get(key) !== model.coreClusterId);
  const total = [...parts.weights.values()].reduce((sum, value) => sum + value, 0);
  const maxCore = Math.max(0, ...model.coreWeights.values());
  return {
    keywordsFound: core.slice(0, SHOWN).map((key) => {
      const context = contextFor(surface(key), excerpts);
      return { term: surface(key), count: count(key), ...(context ? { context } : {}) };
    }),
    offTopicKeywords: foreign.slice(0, SHOWN).map((key) => ({
      term: surface(key), count: count(key), cluster: labels.get(model.termCluster.get(key) ?? '') ?? '',
    })),
    foreignClusters: [...parts.foreignMass].map(([id, mass]) => ({ label: labels.get(id) ?? id, sharePct: round1((mass / total) * 100) }))
      .sort((a, b) => b.sharePct - a.sharePct || (a.label < b.label ? -1 : 1)),
    alignment: keys.slice(0, MATRIX_ROWS).map((key) => {
      const relevancePct = relevanceOf(key, model, maxCore);
      return { term: surface(key), freq: count(key), relevancePct, level: alignmentLevel(relevancePct) };
    }),
  };
};
