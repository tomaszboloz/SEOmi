import i18n from '@/i18n';
import { AIO_ALERT_CALIBRATION_VERSION } from './aioCalibration';
import { alertFingerprint, defaultMonitoringAlertSettings } from './policy';
import type { MonitoringAlert, MonitoringAlertSettings } from './types';

export type ScoreDropKind = 'aio' | 'trust' | 'igos';

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const evaluateScoreDropAlert = (
  kind: ScoreDropKind,
  previous: { score: number | null } | undefined,
  next: { score: number | null },
  sourceId: string,
  settings: MonitoringAlertSettings = defaultMonitoringAlertSettings(),
  /** Phrase shown in the IGOS alert body. */
  phrase = '',
): MonitoringAlert | null => {
  if (!previous || typeof previous.score !== 'number' || typeof next.score !== 'number' || !Number.isFinite(previous.score) || !Number.isFinite(next.score)) return null;
  const difference = previous.score - next.score;
  const points = round1(difference);
  const tolerance = Number.EPSILON * Math.max(Math.abs(previous.score), Math.abs(next.score), 1);
  const type = kind === 'aio' ? 'aio' : 'focus';
  if (kind === 'aio' ? difference + tolerance < settings.thresholds.aio.dropPoints : points <= settings.thresholds.focus.dropPoints) return null;
  const evidence: MonitoringAlert['evidence'] = kind === 'aio'
    ? { kind, before: previous.score, after: next.score, drop: points, calibrationVersion: AIO_ALERT_CALIBRATION_VERSION }
    : { kind, from: previous.score, to: next.score, points };
  return {
    type,
    sourceId,
    title: i18n.t(`scoreDropAlert.${kind}.title`),
    body: i18n.t(`scoreDropAlert.${kind}.body`, { from: previous.score, to: next.score, points, phrase }),
    occurredAt: new Date().toISOString(),
    partial: false,
    evidence,
    fingerprint: alertFingerprint(type, sourceId, evidence),
  };
};
