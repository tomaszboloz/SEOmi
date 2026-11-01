import { hammingDistance, perceptualHash, type GrayImage } from './phash';

/**
 * Threshold calibration on labelled pairs (#96 D02). The built-in fixtures are synthetic and seeded, so the
 * result is reproducible, but real photos need the user's own labelled pairs: the default stays adjustable.
 */
export interface LabelledPair { a: GrayImage; b: GrayImage; duplicate: boolean }
export interface Calibration { threshold: number; falsePositives: number; falseNegatives: number; duplicates: number; distinct: number }

const lcg = (seed: number) => { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; }; };

/** Smooth seeded texture: coarse random blocks, so different seeds give different pictures. */
export const syntheticImage = (seed: number, size = 64): GrayImage => {
  const random = lcg(seed);
  const cells = Array.from({ length: 64 }, () => Math.floor(random() * 220));
  return { width: size, height: size, gray: Array.from({ length: size * size }, (_, i) => cells[Math.floor(((i / size) | 0) * 8 / size) * 8 + Math.floor(((i % size) * 8) / size)]) };
};

export const brighten = (image: GrayImage, delta: number): GrayImage => ({ ...image, gray: Array.from(image.gray, (value) => Math.max(0, Math.min(255, value + delta))) });
export const noisy = (image: GrayImage, amplitude: number, seed: number): GrayImage => {
  const random = lcg(seed);
  return { ...image, gray: Array.from(image.gray, (value) => Math.max(0, Math.min(255, value + (random() - 0.5) * 2 * amplitude))) };
};
export const downscale = (image: GrayImage, factor: number): GrayImage => {
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  return { width, height, gray: Array.from({ length: width * height }, (_, i) => image.gray[Math.floor(i / width) * factor * image.width + (i % width) * factor]) };
};

export const fixturePairs = (): LabelledPair[] => {
  const originals = Array.from({ length: 12 }, (_, index) => syntheticImage(index + 1));
  const duplicates = originals.flatMap((image, index) => [brighten(image, 25), noisy(image, 12, index + 100), downscale(image, 2)]
    .map((variant) => ({ a: image, b: variant, duplicate: true })));
  const distinct = originals.flatMap((image, index) => originals.slice(index + 1).map((other) => ({ a: image, b: other, duplicate: false })));
  return [...duplicates, ...distinct];
};

/** Largest threshold with the fewest errors; ties go to the lower threshold (stricter matching). */
export const calibrateThreshold = (pairs: readonly LabelledPair[], range = 16): Calibration => {
  const scored = pairs.map((pair) => ({ distance: hammingDistance(perceptualHash(pair.a), perceptualHash(pair.b)) ?? Infinity, duplicate: pair.duplicate }));
  const errors = (threshold: number) => ({
    falsePositives: scored.filter((item) => !item.duplicate && item.distance <= threshold).length,
    falseNegatives: scored.filter((item) => item.duplicate && item.distance > threshold).length,
  });
  let best = { threshold: 0, ...errors(0) };
  for (let threshold = 1; threshold <= range; threshold += 1) {
    const current = { threshold, ...errors(threshold) };
    if (current.falsePositives + current.falseNegatives < best.falsePositives + best.falseNegatives) best = current;
  }
  return { ...best, duplicates: scored.filter((item) => item.duplicate).length, distinct: scored.filter((item) => !item.duplicate).length };
};
