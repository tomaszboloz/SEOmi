import { monitorSiteFocus, readMonitoringSettings, focusAlertEvents, contentGuardEvents, type MonitoringDelivery } from '@/services/monitoringAlerts';
import {
  annotateChange, buildSiteFocusReport, makeSnapshot, scoreIncremental,
  type AlertEvent, type FocusPage, type PageFocus, type SfsSnapshot, type SiteFocusReport,
} from '@/services/siteFocus';
import type { CrawlRunRecord } from '@/types';
import type { BrandPolicyInput } from '@/services/siteFocus/types';
import type { Clock } from './budget';
import { registerSeenUrls } from './firstSeen';
import { appendFocusHistory, readFocusHistory, type FocusHistoryEntry } from './history';
import type { ManualTopic } from './topic';

export interface AnalysisDeps { clock?: Clock; notify?: boolean; delivery?: MonitoringDelivery }

export const buildRunReport = (
  run: CrawlRunRecord, manualTopic?: ManualTopic, now?: string, anchorUrls?: readonly string[], businessGoal?: string, brand?: BrandPolicyInput,
): SiteFocusReport =>
  buildSiteFocusReport(run.result.pages as FocusPage[], run.startUrl, {
    manualTopic, ...(now ? { now } : {}), ...(anchorUrls?.length ? { anchorUrls: [...anchorUrls] } : {}), ...(businessGoal ? { businessGoal } : {}),
    ...(brand && Object.keys(brand).length ? { brand } : {}),
  });

export const isCompletedRun = (run: CrawlRunRecord | null | undefined): run is CrawlRunRecord =>
  Boolean(run && run.result && !run.result.cancelled && !run.result.timed_out && run.result.pages.length);

export interface FullAnalysisRecord { saved: boolean; snapshot: SfsSnapshot; previous?: SfsSnapshot; entries: FocusHistoryEntry[]; events: AlertEvent[] }

const versionOf = (snapshot: Pick<SfsSnapshot, 'profile' | 'coreConfigHash'>): string => `${snapshot.profile?.configHash ?? 'legacy'}:${snapshot.coreConfigHash ?? 'legacy'}`;

/**
 * History id of a report (#82 GEM-82-07): the run id for its first version; a report of the same run
 * built with another Core Topic configuration or profile gets its own versioned id, so the earlier
 * snapshot is kept unchanged instead of being overwritten or silently skipped.
 */
export const historyRunId = (entries: FocusHistoryEntry[], report: SiteFocusReport, runId: string): string => {
  const first = entries.find((entry) => entry.snapshot.runId === runId);
  const version = versionOf(report);
  return !first || versionOf(first.snapshot) === version ? runId : `${runId}:v:${version}`;
};

/** Stores a full-analysis snapshot once per run and configuration and raises SFS-drop / Content Guard alerts. */
export const recordFullAnalysis = (projectId: string, report: SiteFocusReport, runId: string, deps: AnalysisDeps = {}): FullAnalysisRecord => {
  const history = readFocusHistory(projectId);
  const previous = history.at(-1)?.snapshot;
  const snapshot = makeSnapshot(report, historyRunId(history, report, runId), report.generatedAt);
  const { saved, entries } = appendFocusHistory(projectId, { snapshot, annotations: previous ? annotateChange(previous, snapshot) : [] });
  if (!saved) return { saved, snapshot, previous, entries, events: [] };
  const fresh = registerSeenUrls(projectId, report.pages.map((page) => page.url), deps.clock);
  const events = focusAlertEvents(previous, snapshot, report.pages.filter((page) => fresh.has(page.url)), readMonitoringSettings(projectId));
  if (deps.notify !== false) void monitorSiteFocus(projectId, events, runId, deps.delivery);
  return { saved, snapshot, previous, entries, events };
};

export interface IncrementalOutcome { scored: PageFocus[]; report: SiteFocusReport; events: AlertEvent[] }

/** Scores only new or changed pages against the existing model; Content Guard fires for pages first seen in 24h. */
export const applyIncremental = (
  projectId: string | null | undefined, report: SiteFocusReport, newPages: FocusPage[], startUrl: string, deps: AnalysisDeps = {},
): IncrementalOutcome => {
  const result = scoreIncremental(report, newPages, startUrl, new Date((deps.clock ?? Date.now)()).toISOString());
  const fresh = registerSeenUrls(projectId, result.scored.map((page) => page.url), deps.clock);
  const events = contentGuardEvents(result.scored.filter((page) => fresh.has(page.url)));
  if (projectId && deps.notify !== false) void monitorSiteFocus(projectId, events, `incremental-${result.report.generatedAt}`, deps.delivery);
  return { ...result, events };
};
