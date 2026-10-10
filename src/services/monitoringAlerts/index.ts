import { sendProjectNotification } from '@/services/desktopNotifications/delivery';
import { readMonitoringSettings, reserveMonitoringAlert } from './persistence';
import { compareGscForMonitoring, comparePageSpeedForMonitoring, evaluateCrawlAlert, evaluateSemanticAlert } from './evaluators';
import type { GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';
import type { PageSpeedSnapshot } from '@/services/pagespeedHistory';
import type { CrawlDiffReport } from '@/services/crawlDiff';
import type { SemanticRunComparisonReport } from '@/services/semanticRunComparison';
import type { MonitoringAlert } from './types';

export * from './types';
export * from './policy';
export * from './persistence';
export * from './evaluators';

export interface MonitoringDelivery { email?: (alert: MonitoringAlert) => Promise<boolean>; }
export interface MonitoringDeliveryResult { alert: MonitoringAlert | null; delivered: boolean; persisted: boolean; duplicate: boolean; emailConfigured: boolean; }

export const deliverMonitoringAlert = async (projectId: string, alert: MonitoringAlert | null, delivery: MonitoringDelivery = {}): Promise<MonitoringDeliveryResult> => {
  if (!alert) return { alert, delivered: false, persisted: false, duplicate: false, emailConfigured: Boolean(delivery.email) };
  const reservation = reserveMonitoringAlert(projectId, alert, readMonitoringSettings(projectId));
  if (!reservation) return { alert, delivered: false, persisted: false, duplicate: false, emailConfigured: Boolean(delivery.email) };
  if (reservation.duplicate) return { alert, delivered: false, persisted: false, duplicate: true, emailConfigured: Boolean(delivery.email) };
  const desktop = await sendProjectNotification(projectId, () => ({ title: alert.title, body: alert.body })).catch(() => false);
  const email = delivery.email ? await delivery.email(alert).catch(() => false) : false;
  const sent = desktop || email;
  const persisted = reservation.finish(sent);
  return { alert, delivered: sent, persisted, duplicate: false, emailConfigured: Boolean(delivery.email) };
};

export const monitorGscSnapshots = (projectId: string, baseline: GscPerformanceSnapshot, current: GscPerformanceSnapshot, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, compareGscForMonitoring(baseline, current, readMonitoringSettings(projectId)), delivery);
export const monitorPageSpeedSnapshots = (projectId: string, baseline: PageSpeedSnapshot, current: PageSpeedSnapshot, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, comparePageSpeedForMonitoring(baseline, current, readMonitoringSettings(projectId)), delivery);
export const monitorCrawlComparison = (projectId: string, report: CrawlDiffReport, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, evaluateCrawlAlert(report, readMonitoringSettings(projectId)), delivery);
export const monitorSemanticComparison = (projectId: string, report: SemanticRunComparisonReport, delivery?: MonitoringDelivery) => deliverMonitoringAlert(projectId, evaluateSemanticAlert(report, readMonitoringSettings(projectId)), delivery);
