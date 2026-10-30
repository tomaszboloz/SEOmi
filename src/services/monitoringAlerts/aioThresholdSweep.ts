import { evaluateAioCalibration, type AioCalibrationCase, type AioCalibrationResult } from './aioCalibration';

/**
 * Threshold calibration hook for AIO drop alerts (issue #108).
 *
 * The harness in aioCalibration.ts only ships hand-written synthetic cases. This hook accepts
 * labelled before/after pairs supplied by a caller (editor feedback, exported alert reviews) and
 * reports how each candidate threshold would have classified them. It never invents labels: when
 * the supplied cases are too few, or contain only one class, no threshold is recommended and the
 * status says why. The recommendation is advisory; the configured threshold is never changed here.
 */
export const AIO_SWEEP_MIN_LABELLED = 20;
export const AIO_SWEEP_DEFAULT_CANDIDATES: readonly number[] = [5, 7.5, 10, 12.5, 15, 20];

export type AioSweepStatus = 'recommended' | 'insufficient-labels' | 'single-class';

export interface AioSweepRow {
  threshold: number;
  /** The base harness's synthetic-only limitation label is dropped: these labels come from the caller. */
  result: Omit<AioCalibrationResult, 'limitation'>;
  /** correct / evaluated; null when no case had both scores. */
  accuracy: number | null;
}

export interface AioSweepReport {
  status: AioSweepStatus;
  labelled: number;
  alertLabels: number;
  noAlertLabels: number;
  rows: AioSweepRow[];
  /** Present only when status is 'recommended'. */
  recommended?: number;
  /** Labels come from the caller; this module cannot tell whether they reflect production data. */
  provenance: 'caller-supplied-labels';
}

const usable = (item: AioCalibrationCase): boolean => (
  item.expected !== 'unavailable' && item.before !== null && item.after !== null
  && Number.isFinite(item.before) && Number.isFinite(item.after)
);

const accuracyOf = (result: AioSweepRow['result']): number | null => (result.evaluated ? result.correct / result.evaluated : null);

/** Ties prefer fewer missed alerts, then the threshold closest to the current setting, then the lower value. */
const better = (a: AioSweepRow, b: AioSweepRow, current: number): boolean => {
  if ((a.accuracy ?? -1) !== (b.accuracy ?? -1)) return (a.accuracy ?? -1) > (b.accuracy ?? -1);
  if (a.result.confusion.missedAlert !== b.result.confusion.missedAlert) return a.result.confusion.missedAlert < b.result.confusion.missedAlert;
  const distance = Math.abs(a.threshold - current) - Math.abs(b.threshold - current);
  return distance !== 0 ? distance < 0 : a.threshold < b.threshold;
};

export const sweepAioThresholds = (
  cases: readonly AioCalibrationCase[],
  candidates: readonly number[] = AIO_SWEEP_DEFAULT_CANDIDATES,
  options: { current?: number; minLabelled?: number } = {},
): AioSweepReport => {
  const current = options.current ?? 10;
  const minLabelled = options.minLabelled ?? AIO_SWEEP_MIN_LABELLED;
  const labelledCases = cases.filter(usable);
  const alertLabels = labelledCases.filter((item) => item.expected === 'alert').length;
  const noAlertLabels = labelledCases.length - alertLabels;
  const thresholds = [...new Set(candidates.filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
  const rows = thresholds.map((threshold) => {
    const { limitation: _synthetic, ...result } = evaluateAioCalibration(labelledCases, threshold);
    return { threshold, result, accuracy: accuracyOf(result) };
  });
  const base = { labelled: labelledCases.length, alertLabels, noAlertLabels, rows, provenance: 'caller-supplied-labels' as const };
  if (labelledCases.length < minLabelled) return { ...base, status: 'insufficient-labels' };
  if (!alertLabels || !noAlertLabels) return { ...base, status: 'single-class' };
  const best = rows.reduce<AioSweepRow | undefined>((winner, row) => (!winner || better(row, winner, current) ? row : winner), undefined);
  return best ? { ...base, status: 'recommended', recommended: best.threshold } : { ...base, status: 'insufficient-labels' };
};
