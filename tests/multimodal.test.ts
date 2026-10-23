import { describe, expect, it } from 'vitest';
import { allModelAnalysisStates, checkAlt, hammingDistance, isNearDuplicate, modelAnalysisState, perceptualHash } from '@/services/multimodal';
import type { GrayImage } from '@/services/multimodal';

const make = (width: number, height: number, pixel: (x: number, y: number) => number): GrayImage => {
  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) gray[y * width + x] = pixel(x / width, y / height);
  return { width, height, gray };
};
const scene = (u: number, v: number): number => Math.round(110 + 80 * Math.sin(u * 9) * Math.cos(v * 5) + (u > 0.5 && v < 0.4 ? 30 : 0));
const other = (u: number, v: number): number => (Math.floor(u * 6) + Math.floor(v * 6)) % 2 === 0 ? 230 : 20;

describe('perceptual hash', () => {
  const base = perceptualHash(make(128, 128, scene));
  it('is a 16 hex character string and stable', () => {
    expect(base).toMatch(/^[0-9a-f]{16}$/);
    expect(perceptualHash(make(128, 128, scene))).toBe(base);
  });

  it('survives resize and brightness shift but differs for another picture', () => {
    const resized = perceptualHash(make(300, 200, scene));
    const brighter = perceptualHash(make(128, 128, (u, v) => Math.min(255, scene(u, v) + 15)));
    const different = perceptualHash(make(128, 128, other));
    expect(hammingDistance(base, resized)).toBeLessThanOrEqual(6);
    expect(hammingDistance(base, brighter)).toBeLessThanOrEqual(6);
    expect(hammingDistance(base, different)).toBeGreaterThan(16);
    expect(isNearDuplicate(base, resized, 6)).toBe(true);
    expect(isNearDuplicate(base, different, 6)).toBe(false);
  });

  it('rejects empty or short buffers and incomparable hashes', () => {
    expect(perceptualHash({ width: 0, height: 4, gray: [] })).toBeNull();
    expect(perceptualHash({ width: 4, height: 4, gray: [1, 2] })).toBeNull();
    expect(hammingDistance(null, base)).toBeNull();
    expect(hammingDistance('ab', 'abc')).toBeNull();
    expect(hammingDistance('zz', 'zz')).toBeNull();
    expect(hammingDistance('ff', '00')).toBe(8);
    expect(isNearDuplicate('ff', 'abc', 3)).toBeNull();
  });

  it('is finite on a flat image', () => {
    expect(perceptualHash({ width: 8, height: 8, gray: new Uint8Array(64).fill(7) })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('alt check', () => {
  it('separates missing from explicit decorative', () => {
    expect(checkAlt({ src: 'a.png' })).toEqual({ role: 'unknown', issues: ['missing'], contextOverlap: null });
    expect(checkAlt({ src: 'a.png', alt: '  ' })).toEqual({ role: 'decorative', issues: [], contextOverlap: null });
  });

  it('flags filename, generic, long, caption repeat and unrelated alt', () => {
    expect(checkAlt({ src: '/x/IMG_2041.jpg', alt: 'IMG_2041.jpg' }).issues).toContain('filename');
    expect(checkAlt({ src: '/x/hero.png?v=1', alt: 'HERO.png' }).issues).toContain('filename');
    expect(checkAlt({ src: '/x/a.png', alt: 'Photo' }).issues).toEqual(['generic']);
    expect(checkAlt({ src: '/x/a.png', alt: 'word '.repeat(30) }).issues).toContain('too-long');
    expect(checkAlt({ src: '/x/a.png', alt: 'Espresso machine', caption: 'espresso MACHINE' }).issues).toContain('repeats-caption');
    expect(checkAlt({ src: '/x/a.png', alt: 'Red bicycle', context: 'Espresso machines brew coffee' })).toMatchObject({ issues: ['unrelated-to-context'], contextOverlap: 0 });
    expect(checkAlt({ src: '/x/a.png', alt: 'Espresso machine', context: 'Our espresso machine brews coffee' })).toMatchObject({ issues: [], contextOverlap: 1 });
    expect(checkAlt({ src: '', alt: 'ok', context: '!!' }).contextOverlap).toBeNull();
  });
});

describe('model analyses', () => {
  it('are explicitly unavailable and never touch the technical audit', () => {
    expect(modelAnalysisState('ocr')).toEqual({ analysis: 'ocr', status: 'unavailable', reason: 'no-local-model', affectsTechnicalAudit: false });
    expect(allModelAnalysisStates().map((state) => state.analysis)).toEqual(['ocr', 'clip-alignment', 'transcript']);
  });
});
