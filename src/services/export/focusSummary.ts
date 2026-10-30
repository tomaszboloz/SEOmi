import { isBorderlineTrs, STRONG_FROM } from '@/services/siteFocus/trsPolicy';
import { buildPagePlaybook, type CodeParams, type PageFocus, type SiteFocusReport } from '@/services/siteFocus';
import { isCompletedRun } from '@/services/siteFocusMonitoring/analysis';
import { buildProjectRunReport } from '@/services/siteFocusMonitoring/projectReport';
import type { CrawlRunRecord } from '@/types';
import { summarizeProtection, type FocusPdfProtection } from './focusProtection';

/** Worst pages listed in the PDF; the full per-page model stays in the app. */
export const FOCUS_PDF_PAGES = 25;
const TOP_TERMS = 8;

export interface FocusPdfSummary {
  /** Null when no page was scored (#53): the PDF shows a dash and the unavailable band, never a critical 0. */
  score: number | null;
  band: string;
  confidence: number | null;
  on_topic_ratio: number | null;
  unavailable?: boolean;
  /** Scoring profile that produced the numbers (#83). */
  profile?: { id: string; algorithm_version: string; config_hash: string };
  /** Competitor terms hidden from the gap list as brand noise, with the reason (#56). */
  brand_filtered?: Array<{ term: string; reason: string }>;
  page_count: number;
  core_topic: {
    label: string; terms: Array<{ term: string; coverage_pct: number }>; manual_input?: string; manual_matched?: boolean;
    /** How the topic was chosen; anchor counts include the home page. */
    mode?: 'auto' | 'manual' | 'goal' | 'anchored'; anchor_source_count?: number; anchor_missing_count?: number;
    /** Explicit business goal as validated (#82) and whether it picked the topic. */
    business_goal?: string; goal_matched?: boolean; goal_applied?: boolean;
  };
  flags: { low_confidence: boolean; multi_topic: boolean; lexical_fallback: boolean; degraded: boolean; skipped_render_timeouts: number };
  counts: { scored: number; skipped: number; off_topic: number; borderline: number; strong: number };
  pages: Array<{
    url: string; type: string; trs: number; similarity: number; overlap: number; drift: number; status: string;
    playbook: { type: string; options: Array<{ code: string; params: CodeParams }> };
  }>;
  recommendations: Array<{ code: string; params: CodeParams; gain: number }>;
  sub_sites: Array<{ label: string; path_prefix: string; share_pct: number; score: number }>;
  gaps: Array<{ code: string; label: string; terms: string[]; coverage_pct: number; pages_covering: number }>;
  /** Advisory URL protection check for low-TRS pages (#81); absent when no page is below the threshold. */
  protection?: FocusPdfProtection;
}

const byWorst = (a: PageFocus, b: PageFocus): number => a.trs - b.trs || (a.url < b.url ? -1 : 1);

/** Compact, serializable digest of a Site Focus report for the PDF renderer (no heavy `model`). */
export const summarizeSiteFocus = (report: SiteFocusReport): FocusPdfSummary => {
  const live = report.pages.filter((page) => !page.skipped);
  const content = live.filter((page) => page.type !== 'technical');
  const worst = [...content].sort(byWorst).slice(0, FOCUS_PDF_PAGES);
  const manual = report.coreTopic.manualOverride;
  const anchors = report.coreTopic.anchors;
  const goal = report.coreTopic.businessGoal;
  const none = report.unavailable === true;
  const profile = report.profile;
  const hidden = report.brandFilter?.filteredGaps ?? [];
  return {
    score: none ? null : report.score,
    band: none ? 'unavailable' : report.band,
    confidence: none ? null : report.confidence,
    on_topic_ratio: none ? null : report.onTopicRatio,
    ...(none ? { unavailable: true } : {}),
    ...(profile ? { profile: { id: profile.id, algorithm_version: profile.algorithmVersion, config_hash: profile.configHash } } : {}),
    ...(hidden.length ? { brand_filtered: hidden.map((item) => ({ term: item.term, reason: item.reason })) } : {}),
    page_count: report.pageCount,
    core_topic: {
      label: report.coreTopic.label,
      terms: report.coreTopic.terms.slice(0, TOP_TERMS).map((item) => ({ term: item.term, coverage_pct: item.coveragePct })),
      ...(manual ? { manual_input: manual.input, manual_matched: manual.matched } : {}),
      mode: report.coreTopic.mode ?? 'auto',
      ...(anchors?.applied ? { anchor_source_count: anchors.sources.length } : {}),
      ...(anchors?.missing.length ? { anchor_missing_count: anchors.missing.length } : {}),
      ...(goal ? { business_goal: goal.input, goal_matched: goal.matched, goal_applied: goal.applied } : {}),
    },
    flags: {
      low_confidence: report.flags.isLowConfidence,
      multi_topic: report.flags.isMultiTopic,
      lexical_fallback: report.flags.fallbackMode === 'lexical',
      degraded: report.flags.degraded,
      skipped_render_timeouts: report.flags.skippedRenderTimeouts,
    },
    counts: {
      scored: live.length,
      skipped: report.pages.length - live.length,
      off_topic: content.filter((page) => page.status === 'off-topic').length,
      borderline: content.filter((page) => isBorderlineTrs(page.trs)).length,
      strong: content.filter((page) => page.trs >= STRONG_FROM).length,
    },
    pages: worst.map((page) => ({
      url: page.url, type: page.type, trs: page.trs, similarity: page.similarity, overlap: page.keywordOverlap, drift: page.semanticDrift,
      status: page.status,
      playbook: {
        type: page.playbook,
        options: buildPagePlaybook(page, report.pages, report.score, report.coreTopic).options.map((option) => ({ code: option.code, params: option.params })),
      },
    })),
    recommendations: report.recommendations.map((item) => ({ code: item.code, params: item.params, gain: item.deltaScore })),
    sub_sites: (report.subSites ?? []).map((site) => ({ label: site.label, path_prefix: site.pathPrefix, share_pct: site.sharePct, score: site.score })),
    gaps: report.gaps.map((gap) => ({ code: gap.code, label: gap.label, terms: gap.terms, coverage_pct: gap.coveragePct, pages_covering: gap.pagesCovering })),
  };
};

/** Summary for a completed run, honouring the project's manual core topic; undefined when nothing can be scored. */
export const crawlFocusSummary = (run: CrawlRunRecord): FocusPdfSummary | undefined => {
  if (!isCompletedRun(run)) return undefined;
  const report = buildProjectRunReport(run, run.projectId);
  const protection = summarizeProtection(report, run.projectId);
  return { ...summarizeSiteFocus(report), ...(protection ? { protection } : {}) };
};
