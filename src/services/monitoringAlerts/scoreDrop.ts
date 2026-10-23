import i18n from '@/i18n';
import { alertFingerprint, defaultMonitoringAlertSettings } from './policy';
import type { MonitoringAlert, MonitoringAlertSettings } from './types';

export type ScoreDropKind = 'aio' | 'trust';

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Alert for a run-over-run score drop of the AI Overviews readiness or E-E-A-T trust report.
 * Reuses the shared "focus" alert type and its drop threshold; no previous snapshot means no alert.
 */
export const evaluateScoreDropAlert = (
  kind: ScoreDropKind,
  previous: { score: number } | undefined,
  next: { score: number },
  sourceId: string,
  settings: MonitoringAlertSettings = defaultMonitoringAlertSettings(),
): MonitoringAlert | null => {
  if (!previous || !Number.isFinite(previous.score) || !Number.isFinite(next.score)) return null;
  const points = round1(previous.score - next.score);
  if (points <= settings.thresholds.focus.dropPoints) return null;
  const evidence = { kind, from: previous.score, to: next.score, points };
  return {
    type: 'focus',
    sourceId,
    title: i18n.t(`scoreDropAlert.${kind}.title`),
    body: i18n.t(`scoreDropAlert.${kind}.body`, { from: previous.score, to: next.score, points }),
    occurredAt: new Date().toISOString(),
    partial: false,
    evidence,
    fingerprint: alertFingerprint('focus', sourceId, evidence),
  };
};
