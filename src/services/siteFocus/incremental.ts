import { bandFor, computeSfs } from './aggregate';
import { applyIndexabilityGate } from './gate';
import { evaluatePage, prepare, typeContext } from './evaluate';
import { LOW_CONFIDENCE_PAGES } from './flags';
import { buildRecommendations } from './recommend';
import type { ScoringModel } from './pageScore';
import type { FocusPage, PageFocus, SiteFocusReport } from './types';

/** Rebuilds the scoring state stored with a report. */
export const modelOf = (report: SiteFocusReport): ScoringModel => ({
  termCluster: new Map(Object.entries(report.model.termCluster)),
  coreClusterId: report.model.coreClusterId,
  coreWeights: new Map(Object.entries(report.model.coreWeights)),
  kCore: report.model.kCore,
});

/**
 * Scores only new or changed pages against the report's existing centroid and idf,
 * then re-aggregates. A full recompute is still needed to move the Core Topic.
 */
export const scoreIncremental = (
  report: SiteFocusReport, changed: FocusPage[], startUrl: string, now: string = new Date().toISOString(),
): { scored: PageFocus[]; report: SiteFocusReport } => {
  const items = applyIndexabilityGate(prepare(changed, startUrl, report.model.language));
  const context = {
    stats: { pageCount: report.model.pageCount, documentFrequency: new Map(Object.entries(report.model.documentFrequency)) },
    model: modelOf(report), mode: report.flags.fallbackMode,
    surfaces: new Map(Object.entries(report.model.surfaces)), labels: new Map(Object.entries(report.model.clusterLabels)),
    type: typeContext(changed, startUrl),
  };
  const scored = items.map((item) => evaluatePage(item, context));
  const replaced = new Set(scored.map((page) => page.url));
  const pages = [...report.pages.filter((page) => !replaced.has(page.url)), ...scored];
  const { score, onTopicRatio } = computeSfs(pages);
  const live = pages.filter((page) => !page.skipped);
  const flags = {
    ...report.flags,
    isLowConfidence: live.length < LOW_CONFIDENCE_PAGES || (report.flags.isLowConfidence && report.confidence < 20 && !report.coreTopic.manualOverride),
    skippedRenderTimeouts: pages.filter((page) => page.skipped === 'render-timeout').length,
  };
  return {
    scored,
    report: {
      ...report, pages, score, band: bandFor(score), onTopicRatio, flags, pageCount: pages.length, generatedAt: now,
      recommendations: buildRecommendations(pages, score, flags, report.gaps, report.linkSuggestions.length, report.subSites ?? []),
    },
  };
};
