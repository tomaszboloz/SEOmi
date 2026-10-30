import { describe, expect, it } from 'vitest';
import { sweepAioThresholds, type AioCalibrationCase } from '@/services/monitoringAlerts';

// Hand-written fixtures exercising the hook's logic; they are not production calibration data.
const labelled = (count: number, before: number, after: number, expected: 'alert' | 'no-alert', prefix: string): AioCalibrationCase[] => (
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, before, after, expected }))
);

describe('AIO threshold sweep hook (#108)', () => {
  it('refuses to recommend a threshold from too few labelled cases', () => {
    const report = sweepAioThresholds(labelled(3, 80, 60, 'alert', 'a'));
    expect(report.status).toBe('insufficient-labels');
    expect(report.recommended).toBeUndefined();
    expect(report.labelled).toBe(3);
    expect(report.provenance).toBe('caller-supplied-labels');
  });

  it('refuses to recommend when every label has the same class', () => {
    const report = sweepAioThresholds(labelled(20, 80, 60, 'alert', 'a'));
    expect(report.status).toBe('single-class');
    expect(report.recommended).toBeUndefined();
  });

  it('keeps unavailable and missing-score cases out of the labelled count and accuracy', () => {
    const cases: AioCalibrationCase[] = [
      { id: 'u', before: 80, after: 50, expected: 'unavailable' },
      { id: 'n', before: null, after: 50, expected: 'alert' },
      { id: 'inf', before: Number.NaN, after: 50, expected: 'no-alert' },
      { id: 'ok', before: 80, after: 50, expected: 'alert' },
    ];
    const report = sweepAioThresholds(cases, [10], { minLabelled: 1 });
    expect(report.labelled).toBe(1);
    expect(report.rows[0].result.evaluated).toBe(1);
    expect(report.rows[0].accuracy).toBe(1);
    expect(report.rows[0].result).not.toHaveProperty('limitation');
  });

  it('recommends the most accurate candidate on caller-supplied labels', () => {
    // Drops of 8 points are labelled as worth an alert, drops of 3 points are not.
    const cases = [...labelled(10, 80, 72, 'alert', 'a'), ...labelled(10, 80, 77, 'no-alert', 'n')];
    const report = sweepAioThresholds(cases);
    expect(report.status).toBe('recommended');
    expect(report.recommended).toBe(7.5);
    expect(report.rows.find((row) => row.threshold === 10)?.result.confusion.missedAlert).toBe(10);
    expect(report.rows.find((row) => row.threshold === 5)?.accuracy).toBe(1);
  });

  it('breaks accuracy ties by fewer missed alerts, then distance to the current setting', () => {
    const cases = [...labelled(10, 80, 60, 'alert', 'a'), ...labelled(10, 80, 79, 'no-alert', 'n')];
    expect(sweepAioThresholds(cases, [5, 10, 15]).recommended).toBe(10);
    expect(sweepAioThresholds(cases, [5, 10, 15], { current: 14 }).recommended).toBe(15);
    expect(sweepAioThresholds(cases, [5, 15], { current: 10 }).recommended).toBe(5);
  });

  it('ignores invalid and duplicate candidates and sorts the rows', () => {
    const report = sweepAioThresholds([], [10, -1, Number.NaN, 0, 5, 10]);
    expect(report.rows.map((row) => row.threshold)).toEqual([5, 10]);
    expect(report.rows[0].accuracy).toBeNull();
  });
});
