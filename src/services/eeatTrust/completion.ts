import type { CrawlRunRecord } from '@/types';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { projectFocusOptions } from '@/services/siteFocusMonitoring/projectReport';
import { monitorScoreDrop } from '@/services/monitoringAlerts';
import { isCompletedCrawlRun } from '@/services/optimizationTasks/crawlEvidence';
import { comparableTrustSnapshots, readTrustHistory, recordTrust, scoringField } from './history';
import { buildTrustReport } from './build';
import { readScoringProfile } from './scoringPreference';
import type { TrustReport, TrustSnapshot } from './types';

export interface CompletedTrustResult {
  report: TrustReport;
  history: TrustSnapshot[];
  previous?: TrustSnapshot;
  alerted: boolean;
}

/** Persist EETV only for a complete crawl; the UI hook later reads the same snapshot. */
export const persistCompletedTrustRun = (projectId: string | null | undefined, run: CrawlRunRecord): CompletedTrustResult | undefined => {
  if (!projectId || !isCompletedCrawlRun(run) || !run.result.pages.length) return undefined;
  const pages = run.result.pages;
  const focus = buildSiteFocusReport(pages, run.startUrl, { ...projectFocusOptions(projectId), now: run.completedAt });
  const report = buildTrustReport(pages, focus, { now: run.completedAt, scoringProfile: readScoringProfile(projectId) });
  const before = readTrustHistory(projectId);
  if (report.score === null) return { report, history: before, alerted: false };
  const previous = before.filter((entry) => entry.runId !== run.id).at(-1);
  const history = recordTrust(projectId, report, run.id);
  const current: TrustSnapshot = { at: report.generatedAt, runId: run.id, score: report.score, layers: report.layers, profileVersion: report.profileVersion, profileId: report.profileId, ...scoringField(report), coverage: report.coverage };
  const alertable = report.articleCount > 0 && Object.values(report.layers).some((value) => value !== undefined);
  const alerted = alertable && !before.some((entry) => entry.runId === run.id) && comparableTrustSnapshots(previous, current);
  if (alerted && previous) void monitorScoreDrop(projectId, 'trust', previous, report, run.id).catch(() => undefined);
  return { report, history, previous: alerted ? previous : undefined, alerted };
};
