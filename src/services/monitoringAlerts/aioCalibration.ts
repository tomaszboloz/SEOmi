export const AIO_ALERT_CALIBRATION_VERSION = 'aio-alert-threshold-synthetic-2026-10-27';

export type AioCalibrationLabel = 'alert' | 'no-alert' | 'unavailable';

export interface AioCalibrationCase {
  id: string;
  before: number | null;
  after: number | null;
  expected: AioCalibrationLabel;
}

export interface AioCalibrationResult {
  version: string;
  threshold: number;
  evaluated: number;
  unavailable: number;
  correct: number;
  incorrect: number;
  confusion: { trueAlert: number; falseAlert: number; trueNoAlert: number; missedAlert: number };
  limitation: 'synthetic-labeled-cases-only';
}

/** Small deterministic harness for threshold decisions, not production calibration. */
export const DEFAULT_AIO_CALIBRATION_CASES: readonly AioCalibrationCase[] = [
  { id: 'stable', before: 80, after: 80, expected: 'no-alert' },
  { id: 'below-threshold', before: 80, after: 70.1, expected: 'no-alert' },
  { id: 'inclusive-threshold', before: 80, after: 70, expected: 'alert' },
  { id: 'large-drop', before: 80, after: 45, expected: 'alert' },
  { id: 'improvement', before: 55, after: 70, expected: 'no-alert' },
  { id: 'missing-before', before: null, after: 50, expected: 'unavailable' },
];

export const evaluateAioCalibration = (
  cases: readonly AioCalibrationCase[] = DEFAULT_AIO_CALIBRATION_CASES,
  threshold = 10,
): AioCalibrationResult => {
  const confusion = { trueAlert: 0, falseAlert: 0, trueNoAlert: 0, missedAlert: 0 };
  let evaluated = 0;
  let unavailable = 0;
  cases.forEach((item) => {
    if (item.before === null || item.after === null || !Number.isFinite(item.before) || !Number.isFinite(item.after)) {
      unavailable += 1;
      return;
    }
    evaluated += 1;
    const actual = item.before - item.after >= threshold ? 'alert' : 'no-alert';
    if (actual === item.expected) {
      if (actual === 'alert') confusion.trueAlert += 1;
      else confusion.trueNoAlert += 1;
    } else if (actual === 'alert') confusion.falseAlert += 1;
    else confusion.missedAlert += 1;
  });
  return {
    version: AIO_ALERT_CALIBRATION_VERSION,
    threshold,
    evaluated,
    unavailable,
    correct: confusion.trueAlert + confusion.trueNoAlert,
    incorrect: confusion.falseAlert + confusion.missedAlert,
    confusion,
    limitation: 'synthetic-labeled-cases-only',
  };
};
