import { computeSfs } from './aggregate';
import { comparableSfsProfiles, type SfsProfileRef } from './profile';
import { isBorderlineTrs, OFF_TOPIC_BELOW } from './trsPolicy';
import type { CodeParams, CoreTopicMode, PageFocus, SiteFocusReport } from './types';

export interface SfsSnapshot {
  runId: string;
  at: string;
  score: number;
  pageCount: number;
  /** No page was scored: the score is not a measurement and must not drive alerts. */
  unavailable?: boolean;
  /** `mode` and `anchorCount` are absent in snapshots saved before #82: provenance unknown, not auto. */
  coreTopic: { label: string; clusterId: string; mode?: CoreTopicMode; anchorCount?: number };
  clusterLabels: string[];
  pages: Record<string, { trs: number; weight: number; type: PageFocus['type'] }>;
  /** Scoring profile (#83); absent in snapshots saved before profiles were recorded. */
  profile?: SfsProfileRef;
  /** Core Topic / brand inputs hash (#82); a new hash for the same run is a new report version. */
  coreConfigHash?: string;
}

export interface HistoryAnnotation {
  code: 'removed-offtopic' | 'new-cluster' | 'optimized-borderline' | 'core-topic-changed' | 'core-mode-changed' | 'profile-changed' | 'config-changed';
  params: CodeParams;
  delta: number;
}
export interface AlertEvent { code: 'sfs-drop' | 'content-guard'; params: CodeParams }

export const SFS_DROP_POINTS = 5;
export const CONTENT_GUARD_TRS = OFF_TOPIC_BELOW;
const OPTIMIZED_MIN_GAIN = 10;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export const makeSnapshot = (report: SiteFocusReport, runId: string, at: string = report.generatedAt): SfsSnapshot => ({
  runId, at, score: report.score, pageCount: report.pageCount,
  ...(report.unavailable ? { unavailable: true } : {}),
  coreTopic: {
    label: report.coreTopic.label, clusterId: report.coreTopic.clusterId, mode: report.coreTopic.mode ?? 'auto',
    ...(report.coreTopic.anchors?.applied ? { anchorCount: report.coreTopic.anchors.sources.length } : {}),
  },
  clusterLabels: report.clusters.map((cluster) => cluster.label),
  ...(report.profile ? { profile: report.profile } : {}),
  ...(report.coreConfigHash ? { coreConfigHash: report.coreConfigHash } : {}),
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
  const optimized = before.filter((page) => isBorderlineTrs(page.trs) && page.url in nextPages && nextPages[page.url].trs - page.trs >= OPTIMIZED_MIN_GAIN);
  if (optimized.length) {
    const lifted = new Map(optimized.map((page) => [page.url, nextPages[page.url].trs]));
    result.push({ code: 'optimized-borderline', params: { count: optimized.length }, delta: round1(computeSfs(before.map((page) => ({ ...page, trs: lifted.get(page.url) ?? page.trs }))).score - baseline) });
  }
  const fresh = next.clusterLabels.filter((label) => !prev.clusterLabels.includes(label));
  if (fresh.length) result.push({ code: 'new-cluster', params: { count: fresh.length, label: fresh[0] }, delta: round1(next.score - prev.score) });
  if (prev.coreTopic.label !== next.coreTopic.label) {
    result.push({ code: 'core-topic-changed', params: { from: prev.coreTopic.label, to: next.coreTopic.label }, delta: round1(next.score - prev.score) });
  }
  const [was, now] = [prev.coreTopic.mode, next.coreTopic.mode];
  if (was && now && was !== now) result.push({ code: 'core-mode-changed', params: { from: was, to: now }, delta: round1(next.score - prev.score) });
  return [...result, ...breakAnnotations(prev, next)];
};

const LEGACY = 'legacy';

/**
 * Whether two snapshots were scored the same way (#83 GEM-83-16): same profile and the same Core Topic
 * inputs. Two pre-#83 snapshots keep the old behaviour; a pre-#83 snapshot next to a profiled one is a
 * break in the trend, because its provenance is unknown.
 */
type Versioned = Pick<SfsSnapshot, 'profile' | 'coreConfigHash'>;
export const comparableSnapshots = (prev: Versioned, next: Versioned): boolean => {
  if (!prev.profile && !next.profile) return true;
  return comparableSfsProfiles(prev.profile, next.profile) && prev.coreConfigHash === next.coreConfigHash;
};

/** Marks a profile or configuration break so the chart never draws an unlabelled jump. */
export const breakAnnotations = (prev: SfsSnapshot, next: SfsSnapshot): HistoryAnnotation[] => {
  const delta = round1(next.score - prev.score);
  if (!comparableSfsProfiles(prev.profile, next.profile) && (prev.profile || next.profile)) {
    return [{ code: 'profile-changed', params: { from: prev.profile?.algorithmVersion ?? LEGACY, to: next.profile?.algorithmVersion ?? LEGACY }, delta }];
  }
  return comparableSnapshots(prev, next) ? [] : [{ code: 'config-changed', params: {}, delta }];
};

/** True when the score fell by more than `points` between two full analyses. */
export const dropMoreThan = (prev: number, next: number, points = SFS_DROP_POINTS): boolean => prev - next > points;

/** Content Guard: a newly seen page that lands below the off-topic line. */
export const contentGuard = (page: Pick<PageFocus, 'trs' | 'skipped'>, threshold = CONTENT_GUARD_TRS): boolean => !page.skipped && page.trs < threshold;

export const evaluateAlerts = (prev: SfsSnapshot | undefined, next: SfsSnapshot, newPages: PageFocus[] = []): AlertEvent[] => {
  const alerts: AlertEvent[] = [];
  if (prev && !prev.unavailable && !next.unavailable && comparableSnapshots(prev, next) && dropMoreThan(prev.score, next.score)) alerts.push({ code: 'sfs-drop', params: { from: prev.score, to: next.score, points: round1(prev.score - next.score) } });
  newPages.filter((page) => contentGuard(page)).forEach((page) => alerts.push({ code: 'content-guard', params: { url: page.url, trs: page.trs } }));
  return alerts;
};
