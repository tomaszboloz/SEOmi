import { describe, expect, it } from 'vitest';
import { datesInWindows, estimateImpact, normalizeByMarket } from '@/services/causalMarket';

const days = Array.from({ length: 28 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
const wiggle = (i: number) => 1 + 0.01 * Math.sin(i * 1.7);
const control = days.map((_, i) => 100 * wiggle(i));
const baseTest = days.map((_, i) => 50 * wiggle(i) * (1 + 0.004 * Math.cos(i)));
const interventionDate = '2026-03-15';
const common = { dates: days, control, interventionDate };

describe('estimateImpact', () => {
  it('detects a real lift without a market shock', () => {
    const test = baseTest.map((v, i) => (i >= 14 ? v * 1.3 : v));
    const out = estimateImpact({ ...common, test, market: null, updateWindows: [] });
    expect(out?.verdict).toBe('positive');
    expect(out?.relativeEffect).toBeCloseTo(0.3, 1);
    expect(out?.marketNormalized).toBe(false);
  });

  it('does not report failure when a market shock hits test and control alike', () => {
    const market = days.map((_, i) => (i >= 14 ? 60 : 100));
    const shock = (values: number[]) => values.map((v, i) => (i >= 14 ? v * 0.6 : v));
    const test = shock(baseTest);
    const windows = [{ start: '2026-03-16', end: '2026-03-27' }];
    const out = estimateImpact({ ...common, control: shock(control), test, market, updateWindows: windows });
    expect(out?.marketNormalized).toBe(true);
    expect(Math.abs(out?.relativeEffect ?? 1)).toBeLessThan(0.02);
    expect(out?.updateWindow).toBe(true);
    expect(out?.verdict).toBe('inconclusive');
  });

  it('reports no effect for flat data and updateWindow=false', () => {
    const out = estimateImpact({ ...common, test: baseTest, market: null, updateWindows: [] });
    expect(out?.verdict).toBe('no-effect');
    expect(out?.updateWindow).toBe(false);
  });

  it('reports a negative effect', () => {
    const test = baseTest.map((v, i) => (i >= 14 ? v * 0.7 : v));
    expect(estimateImpact({ ...common, test, market: null, updateWindows: [] })?.verdict).toBe('negative');
  });

  it('returns null without usable history', () => {
    expect(estimateImpact({ ...common, test: baseTest.slice(1), market: null, updateWindows: [] })).toBeNull();
    expect(estimateImpact({ ...common, test: baseTest, market: null, updateWindows: [], interventionDate: '2026-03-05' })).toBeNull();
    expect(estimateImpact({ ...common, test: baseTest, market: null, updateWindows: [], interventionDate: '2026-04-01' })).toBeNull();
  });

  it('falls back to raw series for an invalid market series and handles constant control', () => {
    const bad = days.map(() => 0);
    expect(estimateImpact({ ...common, test: baseTest, market: bad, updateWindows: [] })?.marketNormalized).toBe(false);
    const flat = estimateImpact({ ...common, control: days.map(() => 10), test: baseTest, market: null, updateWindows: [] });
    expect(flat?.verdict).toBeDefined();
  });
});

describe('normalizeByMarket', () => {
  it('scales by relative market level and rejects bad input', () => {
    expect(normalizeByMarket([10, 20, 10], [100, 50, 100], 1)).toEqual([10, 40, 10]);
    expect(normalizeByMarket([1], [1, 2], 1)).toBeNull();
    expect(normalizeByMarket([1], [1], 0)).toBeNull();
  });
  it('finds dates in windows', () => {
    expect(datesInWindows(['2026-01-01', '2026-01-05'], [{ start: '2026-01-04', end: '2026-01-06' }])).toEqual(['2026-01-05']);
  });
});
