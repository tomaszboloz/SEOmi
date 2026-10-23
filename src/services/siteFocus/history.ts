import { computeSfs } from './aggregate';
import type { CodeParams, PageFocus, SiteFocusReport } from './types';

export interface SfsSnapshot {
  runId: string;
  at: string;
  score: number;
  pageCount: number;
  /** No page was scored: the score is not a measurement and must not drive alerts. */
  unavailable?: boolean;
  coreTopic: { label: string; clusterId: string };
  clusterLabels: string[];
  pages: Record<string, { trs: number; weight: number; type: PageFocus['type'] }>;
}

export interface HistoryAnnotation { code: 'removed-offtopic' | 'new-cluster' | 'optimized-borderline' | 'core-topic-changed'; params: CodeParams; delta: number }
export interface AlertEvent { code: 'sfs-drop' | 'content-guard'; params: CodeParams }

export const SFS_DROP_POINTS = 5;
export const CONTENT_GUARD_TRS = 40;
const OPTIMIZED_MIN_GAIN = 10;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export const makeSnapshot = (report: SiteFocusReport, runId: string, at: string = report.generatedAt): SfsSnapshot => ({
  runId, at, score: report.score, pageCount: report.pageCount,
  ...(report.unavailable ? { unavailable: true } : {}),
  coreTopic: { label: report.coreTopic.label, clusterId: report.coreTopic.clusterId },
  clusterLabels: report.clusters.map((cluster) => cluster.label),
  pages: Object.fromEntries(report.pages.filter((page) => !page.skipped).map((page) => [page.url, { trs: page.trs, weight: page.weight, type: page.type }])),
});

const entries = (snapshot: SfsSnapshot) => Object.entries(snapshot.pages).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  .map(([url, page]) => ({ url, ...page }));

/** Explains what changed between two full analyses, with the score effect of each change. */
export const annotateChange = (prev: SfsSnapshot, next: SfsSnapshot): HistoryAnnotation[] => {
  const before = entries(prev);
  const nextPages = next.pages;
  const result: HistoryAnnotation[] = [];
  const baseline = computeSfs(before).score;
  const removed = before.filter((page) => page.trs < CONTENT_GUARD_TRS && page.type !== 'technical' && !(page.url in nextPages));
  if (removed.length) {
    const gone = new Set(removed.map((page) => page.url));
    result.push({ code: 'removed-offtopic', params: { count: removed.length }, delta: round1(computeSfs(before.filter((page) => !gone.has(page.url))).score - baseline) });
  }
  const optimized = before.filter((page) => page.trs >= CONTENT_GUARD_TRS && page.trs < 75 && page.url in nextPages && nextPages[page.url].trs - page.trs >= OPTIMIZED_MIN_GAIN);
  if (optimized.length) {
    const lifted = new Map(optimized.map((page) => [page.url, nextPages[page.url].trs]));
    result.push({ code: 'optimized-borderline', params: { count: optimized.length }, delta: round1(computeSfs(before.map((page) => ({ ...page, trs: lifted.get(page.url) ?? page.trs }))).score - baseline) });
  }
  const fresh = next.clusterLabels.filter((label) => !prev.clusterLabels.includes(label));
  if (fresh.length) result.push({ code: 'new-cluster', params: { count: fresh.length, label: fresh[0] }, delta: round1(next.score - prev.score) });
  if (prev.coreTopic.label !== next.coreTopic.label) {
    result.push({ code: 'core-topic-changed', params: { from: prev.coreTopic.label, to: next.coreTopic.label }, delta: round1(next.score - prev.score) });
  }
  return result;
};

/** True when the score fell by more than `points` between two full analyses. */
export const dropMoreThan = (prev: number, next: number, points = SFS_DROP_POINTS): boolean => prev - next > points;

/** Content Guard: a newly seen page that lands below the off-topic line. */
export const contentGuard = (page: Pick<PageFocus, 'trs' | 'skipped'>, threshold = CONTENT_GUARD_TRS): boolean => !page.skipped && page.trs < threshold;

export const evaluateAlerts = (prev: SfsSnapshot | undefined, next: SfsSnapshot, newPages: PageFocus[] = []): AlertEvent[] => {
  const alerts: AlertEvent[] = [];
  if (prev && !prev.unavailable && !next.unavailable && dropMoreThan(prev.score, next.score)) alerts.push({ code: 'sfs-drop', params: { from: prev.score, to: next.score, points: round1(prev.score - next.score) } });
  newPages.filter((page) => contentGuard(page)).forEach((page) => alerts.push({ code: 'content-guard', params: { url: page.url, trs: page.trs } }));
  return alerts;
};
