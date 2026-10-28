import { isBorderlineTrs, STRONG_FROM } from '@/services/siteFocus/trsPolicy';
import { buildPagePlaybook, type CodeParams, type PageFocus, type SiteFocusReport } from '@/services/siteFocus';
import { buildRunReport, isCompletedRun } from '@/services/siteFocusMonitoring/analysis';
import { readManualTopic } from '@/services/siteFocusMonitoring/topic';
import type { CrawlRunRecord } from '@/types';

/** Worst pages listed in the PDF; the full per-page model stays in the app. */
export const FOCUS_PDF_PAGES = 25;
const TOP_TERMS = 8;

export interface FocusPdfSummary {
  score: number;
  band: string;
  confidence: number;
  on_topic_ratio: number;
  page_count: number;
  core_topic: { label: string; terms: Array<{ term: string; coverage_pct: number }>; manual_input?: string; manual_matched?: boolean };
  flags: { low_confidence: boolean; multi_topic: boolean; lexical_fallback: boolean; degraded: boolean; skipped_render_timeouts: number };
  counts: { scored: number; skipped: number; off_topic: number; borderline: number; strong: number };
  pages: Array<{
    url: string; type: string; trs: number; similarity: number; overlap: number; drift: number; status: string;
    playbook: { type: string; options: Array<{ code: string; params: CodeParams }> };
  }>;
  recommendations: Array<{ code: string; params: CodeParams; gain: number }>;
  sub_sites: Array<{ label: string; path_prefix: string; share_pct: number; score: number }>;
  gaps: Array<{ code: string; label: string; terms: string[]; coverage_pct: number; pages_covering: number }>;
}

const byWorst = (a: PageFocus, b: PageFocus): number => a.trs - b.trs || (a.url < b.url ? -1 : 1);

/** Compact, serializable digest of a Site Focus report for the PDF renderer (no heavy `model`). */
export const summarizeSiteFocus = (report: SiteFocusReport): FocusPdfSummary => {
  const live = report.pages.filter((page) => !page.skipped);
  const content = live.filter((page) => page.type !== 'technical');
  const worst = [...content].sort(byWorst).slice(0, FOCUS_PDF_PAGES);
  const manual = report.coreTopic.manualOverride;
  return {
    score: report.score,
    band: report.band,
    confidence: report.confidence,
    on_topic_ratio: report.onTopicRatio,
    page_count: report.pageCount,
    core_topic: {
      label: report.coreTopic.label,
      terms: report.coreTopic.terms.slice(0, TOP_TERMS).map((item) => ({ term: item.term, coverage_pct: item.coveragePct })),
      ...(manual ? { manual_input: manual.input, manual_matched: manual.matched } : {}),
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
  return summarizeSiteFocus(buildRunReport(run, readManualTopic(run.projectId)));
};
