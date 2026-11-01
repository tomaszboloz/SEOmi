import i18n from '@/i18n';
import type { MetricDelta } from '@/services/optimizationTasks/metricHistory';
import { alertFingerprint, defaultMonitoringAlertSettings } from './policy';
import type { MonitoringAlert, MonitoringAlertSettings } from './types';

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * metricHistory feeds the alert policy (#106): verified optimization tasks whose measured score fell.
 * Fires when the worst new drop reaches the shared `focus.dropPoints` threshold; improvements and
 * unmeasured tasks never alert.
 */
export const evaluateTaskRegressionAlert = (
  rows: MetricDelta[], sourceId: string, settings: MonitoringAlertSettings = defaultMonitoringAlertSettings(), occurredAt = new Date().toISOString(),
): MonitoringAlert | null => {
  const dropped = rows.filter((row) => row.status === 'failed' && row.delta < 0).sort((a, b) => a.delta - b.delta || (a.taskId < b.taskId ? -1 : 1));
  const worst = dropped[0];
  if (!worst || -worst.delta < settings.thresholds.focus.dropPoints) return null;
  const evidence: MonitoringAlert['evidence'] = { kind: 'task-regression', tasks: dropped.length, worst: round1(worst.delta), module: worst.module, url: worst.url };
  return {
    type: 'focus',
    sourceId,
    title: i18n.t('scoreDropAlert.taskRegression.title'),
    body: i18n.t('scoreDropAlert.taskRegression.body', { count: dropped.length, worst: round1(-worst.delta), url: worst.url }),
    occurredAt,
    partial: false,
    evidence,
    fingerprint: alertFingerprint('focus', sourceId, evidence),
  };
};
