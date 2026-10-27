import { deliverMonitoringAlert, readMonitoringSettings, type MonitoringDelivery } from '@/services/monitoringAlerts';
import { registerSeenUrls, type Clock } from '@/services/siteFocusMonitoring';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';
import type { TopicalBenchmark } from '@/services/topicalAuthorityReference';
import { authorityAlertEvents, evaluateAuthorityAlert, type AuthorityAlertEvent } from './alerts';
import { readTopicalBenchmark, writeTopicalBenchmark } from './benchmarkStore';
import { annotateAuthority, appendAuthorityHistory, makeAuthoritySnapshot, readAuthorityHistory, type AuthorityHistoryEntry, type AuthoritySnapshot } from './history';

export interface AuthorityRecordDeps { clock?: Clock; notify?: boolean; delivery?: MonitoringDelivery; benchmark?: TopicalBenchmark | null }

export interface AuthorityRecord {
  saved: boolean;
  snapshot: AuthoritySnapshot;
  previous?: AuthoritySnapshot;
  entries: AuthorityHistoryEntry[];
  events: AuthorityAlertEvent[];
}

/**
 * Stores one authority snapshot per runId, then raises TAS-drop, post-publish cannibalization,
 * Competitor Radar and Content Decay alerts. Never throws into the caller's analysis flow.
 */
export const recordAuthority = (projectId: string, report: TopicalAuthorityReport, runId: string, urls: string[], deps: AuthorityRecordDeps = {}): AuthorityRecord => {
  const previous = readAuthorityHistory(projectId).at(-1)?.snapshot;
  const snapshot = makeAuthoritySnapshot(report, runId);
  const { saved, entries } = appendAuthorityHistory(projectId, { snapshot, annotations: previous ? annotateAuthority(previous, snapshot) : [] });
  if (!saved) return { saved, snapshot, previous, entries, events: [] };
  const previousBenchmark = readTopicalBenchmark(projectId);
  if (deps.benchmark) writeTopicalBenchmark(projectId, deps.benchmark);
  const fresh = registerSeenUrls(projectId, urls, deps.clock);
  const events = authorityAlertEvents({ previous, next: snapshot, report, fresh, previousBenchmark, benchmark: deps.benchmark, settings: readMonitoringSettings(projectId) });
  if (deps.notify !== false) void deliverMonitoringAlert(projectId, evaluateAuthorityAlert(events, `authority:${runId}`), deps.delivery);
  return { saved, snapshot, previous, entries, events };
};
