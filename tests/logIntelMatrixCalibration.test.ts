import { expect, it } from 'vitest';
import { calibrateMatrix, classifyCrawl, DEFAULT_MATRIX, FIXTURE_CASES } from '@/services/logIntelligence';

it('classifies one page by trs and bot hits', () => {
  const o = DEFAULT_MATRIX;
  expect(classifyCrawl(20, 100, o)).toBe('waste');
  expect(classifyCrawl(80, 0, o)).toBe('starvation');
  expect(classifyCrawl(80, 40, o)).toBe('ok');
});

it('fixture calibration lands on the shipped defaults with no misclassification', () => {
  const result = calibrateMatrix();
  expect(result).toMatchObject({ errors: 0, cases: FIXTURE_CASES.length });
  expect(result).toMatchObject({ wasteMaxTrs: DEFAULT_MATRIX.wasteMaxTrs, wasteMinHits: DEFAULT_MATRIX.wasteMinHits, starvationMaxHits: DEFAULT_MATRIX.starvationMaxHits });
});

it('moves thresholds when labels demand it and keeps the nearest on ties', () => {
  const strict = calibrateMatrix([{ trs: 20, hits: 10, verdict: 'waste' }, { trs: 80, hits: 3, verdict: 'starvation' }]);
  expect(strict.errors).toBe(0);
  expect(strict.wasteMinHits).toBeLessThan(10);
  expect(strict.starvationMaxHits).toBeGreaterThan(3);
  expect(calibrateMatrix([]).errors).toBe(0);
});
