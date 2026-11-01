import { expect, it } from 'vitest';
import { DEFAULT_MAX_DISTANCE, calibrateThreshold, fixturePairs, hammingDistance, perceptualHash, syntheticImage } from '@/services/multimodal';

it('is deterministic per seed and distinct across seeds', () => {
  expect(perceptualHash(syntheticImage(1))).toBe(perceptualHash(syntheticImage(1)));
  expect(hammingDistance(perceptualHash(syntheticImage(1)), perceptualHash(syntheticImage(2)))).toBeGreaterThan(0);
});

it('calibrates on fixtures and the shipped default separates them without errors', () => {
  const result = calibrateThreshold(fixturePairs());
  console.info('calibration', JSON.stringify(result));
  expect(result.duplicates).toBe(36);
  expect(result.distinct).toBe(66);
  expect(result.falsePositives + result.falseNegatives).toBe(0);
  const atDefault = calibrateThreshold(fixturePairs(), DEFAULT_MAX_DISTANCE);
  expect(atDefault).toMatchObject({ falsePositives: 0, falseNegatives: 0 });
});

it('counts uncomparable pairs as misses and respects a short range', () => {
  const empty = { width: 0, height: 0, gray: [] };
  const result = calibrateThreshold([{ a: empty, b: empty, duplicate: true }, { a: empty, b: empty, duplicate: false }], 2);
  expect(result).toEqual({ threshold: 0, falsePositives: 0, falseNegatives: 1, duplicates: 1, distinct: 1 });
});
