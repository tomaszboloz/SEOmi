import { describe, expect, it } from 'vitest';
import { sweepAioThresholds, AIO_SWEEP_DEFAULT_CANDIDATES } from '@/services/monitoringAlerts/aioThresholdSweep';
import type { AioCalibrationCase } from '@/services/monitoringAlerts/aioCalibration';

/** Fixture labels: editor-style judgement that a drop of >= 10 points deserves an alert. Re-calibrate by replacing this table with exported labels. */
const DROPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const alertDrops = [10, 11, 12, 14, 16, 18, 20, 25, 30, 40];
const FIXTURE: AioCalibrationCase[] = [
  ...DROPS.map((drop) => ({ id: `quiet-${drop}`, before: 70, after: 70 - drop, expected: 'no-alert' as const })),
  ...alertDrops.map((drop) => ({ id: `drop-${drop}`, before: 70, after: 70 - drop, expected: 'alert' as const })),
];

describe('AIO drop threshold calibration on fixtures (#108)', () => {
  it('recommends the shipped default of 10 points for the fixture labels', () => {
    const report = sweepAioThresholds(FIXTURE, AIO_SWEEP_DEFAULT_CANDIDATES, { current: 10 });
    expect(report.status).toBe('recommended');
    expect(report.recommended).toBe(10);
    expect(report.labelled).toBe(20);
    expect(report.rows.find((row) => row.threshold === 10)?.accuracy).toBe(1);
  });
  it('stays advisory with too few labels', () => {
    expect(sweepAioThresholds(FIXTURE.slice(0, 5), AIO_SWEEP_DEFAULT_CANDIDATES).status).toBe('insufficient-labels');
  });
});
