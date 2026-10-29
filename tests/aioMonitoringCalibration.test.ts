import { describe, expect, it } from 'vitest';
import { DEFAULT_AIO_CALIBRATION_CASES, evaluateAioCalibration } from '@/services/monitoringAlerts';

describe('AIO alert threshold harness', () => {
  it('is deterministic and keeps unavailable data outside accuracy', () => {
    const result = evaluateAioCalibration();
    expect(result).toMatchObject({
      version: 'aio-alert-threshold-synthetic-2026-10-27', threshold: 10,
      evaluated: 5, unavailable: 1, correct: 5, incorrect: 0,
      limitation: 'synthetic-labeled-cases-only',
    });
    expect(evaluateAioCalibration()).toEqual(result);
  });

  it('makes the inclusive threshold boundary explicit', () => {
    expect(evaluateAioCalibration([{ id: 'boundary', before: 100, after: 90, expected: 'alert' }]).correct).toBe(1);
    expect(evaluateAioCalibration([{ id: 'below', before: 100, after: 90.01, expected: 'no-alert' }]).correct).toBe(1);
  });

  it('allows a labeled fixture set to be inspected without claiming real-world calibration', () => {
    expect(DEFAULT_AIO_CALIBRATION_CASES.some((item) => item.expected === 'unavailable')).toBe(true);
    expect(evaluateAioCalibration(DEFAULT_AIO_CALIBRATION_CASES, 20).incorrect).toBeGreaterThan(0);
  });

  it('labels the harness as synthetic and never reports real-world calibration', () => {
    expect(evaluateAioCalibration([]).limitation).toBe('synthetic-labeled-cases-only');
    expect(evaluateAioCalibration([]).version).toContain('synthetic');
  });
});
