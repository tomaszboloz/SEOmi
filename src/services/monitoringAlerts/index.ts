import { sendProjectNotification } from '@/services/desktopNotifications/delivery';
import { readMonitoringSettings } from './persistence';
import { reserveDispatch } from './nativeLedger';
import { compareGscForMonitoring, comparePageSpeedForMonitoring, evaluateCrawlAlert, evaluateSemanticAlert } from './evaluators';
import type { GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';
import type { PageSpeedSnapshot } from '@/services/pagespeedHistory';
import type { CrawlDiffReport } from '@/services/crawlDiff';
import type { SemanticRunComparisonReport } from '@/services/semanticRunComparison';
import { evaluateFocusAlert } from './focus';
import { evaluateScoreDropAlert, type ScoreDropKind } from './scoreDrop';
import { evaluateTopSetChangeAlert } from './topSetChange';
import { evaluateTaskRegressionAlert } from './taskRegression';
import type { MetricDelta } from '@/services/optimizationTasks/metricHistory';
import type { AlertEvent } from '@/services/siteFocus';
import type { MonitoringAlert } from './types';
import { compareAioForMonitoring, previousComparableAioCrawl } from './aio';
import type { CrawlRunRecord } from '@/types';

export * from './types';
export * from './policy';
export * from './persistence';
export * from './nativeLedger';
export * from './evaluators';
export * from './focus';
export * from './scoreDrop';
export * from './topSetChange';
export * from './taskRegression';
export * from './aio';
export * from './aioCalibration';
export * from './aioThresholdSweep';
export * from './aioLabelling';

export interface MonitoringDelivery { email?: (alert: MonitoringAlert) => Promise<boolean>; }
export interface MonitoringDeliveryResult { alert: MonitoringAlert | null; delivered: boolean; persisted: boolean; duplicate: boolean; emailConfigured: boolean; }

export const deliverMonitoringAlert = async (projectId: string, alert: MonitoringAlert | null, delivery: MonitoringDelivery = {}): Promise<MonitoringDeliveryResult> => {
  if (!alert) return { alert, delivered: false, persisted: false, duplicate: false, emailConfigured: Boolean(delivery.email) };
  const reservation = await reserveDispatch(projectId, alert, readMonitoringSettings(projectId));
  if (!reservation) return { alert, delivered: false, persisted: false, duplicate: false, emailConfigured: Boolean(delivery.email) };
  if (reservation.duplicate) return { alert, delivered: false, persisted: false, duplicate: true, emailConfigured: Boolean(delivery.email) };
  const desktop = await sendProjectNotification(projectId, () => ({ title: alert.title, body: alert.body })).catch(() => false);
  const email = delivery.email ? await delivery.email(alert).catch(() => false) : false;
  const sent = desktop || email;
  const persisted = await reservation.finish(sent);
  return { alert, delivered: sent, persisted, duplicate: false, emailConfigured: Boolean(delivery.email) };
};

export const monitorGscSnapshots = (projectId: string, baseline: GscPerformanceSnapshot, current: GscPerformanceSnapshot, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, compareGscForMonitoring(baseline, current, readMonitoringSettings(projectId)), delivery);
export const monitorPageSpeedSnapshots = (projectId: string, baseline: PageSpeedSnapshot, current: PageSpeedSnapshot, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, comparePageSpeedForMonitoring(baseline, current, readMonitoringSettings(projectId)), delivery);
export const monitorCrawlComparison = (projectId: string, report: CrawlDiffReport, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, evaluateCrawlAlert(report, readMonitoringSettings(projectId)), delivery);
export const monitorSemanticComparison = (projectId: string, report: SemanticRunComparisonReport, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, evaluateSemanticAlert(report, readMonitoringSettings(projectId)), delivery);
export const monitorSiteFocus = (projectId: string, events: AlertEvent[], sourceId: string, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, evaluateFocusAlert(events, sourceId), delivery);
export const monitorScoreDrop = (projectId: string, kind: ScoreDropKind, previous: { score: number | null } | undefined, next: { score: number | null }, runId: string, delivery?: MonitoringDelivery, phrase?: string) => deliverMonitoringAlert(projectId, evaluateScoreDropAlert(kind, previous, next, `${kind}-${runId}`, readMonitoringSettings(projectId), phrase), delivery);
export const monitorTopSetChange = (projectId: string, previousUrls: string[], currentUrls: string[], runId: string, phrase: string, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, evaluateTopSetChangeAlert(previousUrls, currentUrls, `igos-top-${runId}`, phrase, readMonitoringSettings(projectId)), delivery);

export const monitorTaskRegression = (projectId: string, rows: MetricDelta[], runId: string, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, evaluateTaskRegressionAlert(rows, `task-regression-${runId}`, readMonitoringSettings(projectId)), delivery);

export const monitorAioCrawls = async (projectId: string, current: CrawlRunRecord, runs: CrawlRunRecord[], delivery?: MonitoringDelivery) => {
  const evaluation = compareAioForMonitoring(previousComparableAioCrawl(current, runs, projectId), current, readMonitoringSettings(projectId), projectId);
  return { ...await deliverMonitoringAlert(projectId, evaluation.alert, delivery), partial: evaluation.partial, skipped: evaluation.skipped };
};
