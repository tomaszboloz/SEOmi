import { semanticPageLanguage } from '@/services/semanticText';
import { bandFor, computeSfs } from './aggregate';
import { applyIndexabilityGate } from './gate';
import { clusterTerms, siteTotals, topTerms } from './cluster';
import { chooseCore, describeClusters, describeCore, labelOf } from './coreTopic';
import { evaluatePage, modelFor, prepare, typeContext, type EvalContext, type Prepared } from './evaluate';
import { analyzeGaps } from './gaps';
import { computeFlags, detectSubSites } from './flags';
import { buildLinkSuggestions } from './links';
import { buildRecommendations } from './recommend';
import { buildTermStats, tfidfVector } from './terms';
import { SITE_FOCUS_VERSION, type FallbackMode, type FocusPage, type SiteFocusModel, type SiteFocusOptions, type SiteFocusReport } from './types';

const DEGRADED_MAJORITY = 0.5;

const dominantLanguage = (pages: FocusPage[]): string => {
  const counts = new Map<string, number>();
  pages.forEach((page) => {
    const language = (semanticPageLanguage(page) ?? '').split(/[-_]/)[0].toLowerCase();
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? '';
};

/** Most frequent surface form per term key. */
const surfaceMap = (items: Prepared[]): Map<string, string> => {
  const counts = new Map<string, Map<string, number>>();
  items.forEach((item) => item.terms.entries.forEach((entry) => {
    const forms = counts.get(entry.key) ?? new Map<string, number>();
    forms.set(entry.surface, (forms.get(entry.surface) ?? 0) + entry.count);
    counts.set(entry.key, forms);
  }));
  return new Map([...counts].map(([key, forms]) => [key, [...forms].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]]));
};

const record = <T>(map: Map<string, T>, keys: Iterable<string>): Record<string, T> =>
  Object.fromEntries([...keys].filter((key) => map.has(key)).sort().map((key) => [key, map.get(key) as T]));

export const buildSiteFocusReport = (pages: FocusPage[], startUrl: string, options: SiteFocusOptions = {}): SiteFocusReport => {
  const language = options.language ?? dominantLanguage(pages);
  const items = applyIndexabilityGate(prepare(pages, startUrl, language), options.includeNonIndexable);
  const live = items.filter((item) => !item.skipped);
  const stats = buildTermStats(live.map((item) => item.terms));
  const vectors = live.map((item) => tfidfVector(item.terms, stats));
  const totals = siteTotals(vectors);
  const { clusters } = clusterTerms(topTerms(totals), vectors, { cut: options.clusterCut, similarity: options.similarity });
  const selection = chooseCore(clusters, totals, options.manualTopic, language);
  const surfaces = surfaceMap(live);
  const labels = new Map(selection.clusters.map((cluster) => [cluster.id, labelOf(cluster.keys, surfaces)]));
  const termCluster = new Map(selection.clusters.flatMap((cluster) => cluster.keys.map((key): [string, string] => [key, cluster.id])));
  const degradedShare = live.length ? live.filter((item) => item.terms.degraded).length / live.length : 0;
  const mode: FallbackMode = options.forceLexical || degradedShare > DEGRADED_MAJORITY ? 'lexical' : 'semantic';
  const model = modelFor(selection.core, selection.kCore, termCluster, totals);
  const context: EvalContext = { stats, model, mode, surfaces, labels, type: typeContext(pages, startUrl) };
  const focus = items.map((item) => evaluatePage(item, context));
  const { score, onTopicRatio } = computeSfs(focus);
  const described = describeClusters(selection.clusters, surfaces, totals);
  const subSites = detectSubSites(described, selection.clusters, items, context, totals);
  const flags = computeFlags(items, selection.confidence, !!selection.manual, mode, subSites.length > 0);
  const gaps = analyzeGaps(items, vectors, selection.core.keys, totals, surfaces, options.competitorTerms ?? [], language);
  const linkSuggestions = buildLinkSuggestions(focus, pages);
  const modelState: SiteFocusModel = {
    language, pageCount: stats.pageCount, clusterLabels: Object.fromEntries(labels), kCore: selection.kCore, coreClusterId: selection.core.id,
    documentFrequency: record(stats.documentFrequency, termCluster.keys()), termCluster: Object.fromEntries([...termCluster].sort()),
    coreWeights: record(model.coreWeights, model.coreWeights.keys()), surfaces: record(surfaces, termCluster.keys()),
  };
  return {
    score, band: bandFor(score), confidence: selection.confidence, onTopicRatio,
    coreTopic: describeCore(selection, surfaces, stats.documentFrequency, stats.pageCount),
    clusters: described, pages: focus, ...(subSites.length ? { subSites } : {}), flags,
    recommendations: buildRecommendations(focus, score, flags, gaps, linkSuggestions.length, subSites),
    gaps, linkSuggestions, model: modelState, generatedAt: options.now ?? new Date().toISOString(),
    pageCount: pages.length, version: SITE_FOCUS_VERSION,
    // No scored page means no measurement: the 0 above is a placeholder, not a result.
    ...(focus.some((page) => !page.skipped) ? {} : { unavailable: true }),
  };
};
