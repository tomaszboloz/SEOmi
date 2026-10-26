import { describe, expect, it } from 'vitest';
import { alignMarketObservations, datesInWindows, estimateImpact, normalizeByMarket } from '@/services/causalMarket';

const days = Array.from({ length: 28 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
const wiggle = (i: number) => 1 + 0.01 * Math.sin(i * 1.7);
const control = days.map((_, i) => 100 * wiggle(i));
const baseTest = days.map((_, i) => 50 * wiggle(i) * (1 + 0.004 * Math.cos(i)));
const interventionDate = '2026-03-15';
const common = {
  dates: days, control, interventionDate, market: days.map(() => 100), marketSource: 'synthetic-regression',
  controlSource: 'independent-control-series', controlIndependent: true,
};

describe('estimateImpact', () => {
  it('detects a real lift without a market shock', () => {
    const test = baseTest.map((v, i) => (i >= 14 ? v * 1.3 : v));
    const out = estimateImpact({ ...common, test, updateWindows: [] });
    expect(out?.verdict).toBe('positive');
    expect(out?.relativeEffect).toBeCloseTo(0.3, 1);
    expect(out?.marketNormalized).toBe(true);
    expect(out?.controlSource).toBe('independent-control-series');
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

  it('propagates null update windows as unavailable feed status in estimateImpact', () => {
    const out = estimateImpact({ ...common, test: baseTest, updateWindows: null });
    expect(out?.updateFeedStatus).toBe('unavailable');
    expect(out?.updateWindow).toBe(true);
    expect(out?.verdict).toBe('inconclusive');
  });

  it('treats omitted update windows as unknown feed status and inconclusive verdict', () => {
    const out = estimateImpact({ ...common, test: baseTest });
    expect(out?.updateFeedStatus).toBe('unknown');
    expect(out?.updateWindow).toBe(true);
    expect(out?.verdict).toBe('inconclusive');
    expect(out?.reason).toBe('update-window');
  });

  it('reports no effect for flat data and updateWindow=false', () => {
    const out = estimateImpact({ ...common, test: baseTest, updateWindows: [] });
    expect(out?.verdict).toBe('no-effect');
    expect(out?.updateWindow).toBe(false);
  });

  it('reports a negative effect', () => {
    const test = baseTest.map((v, i) => (i >= 14 ? v * 0.7 : v));
    expect(estimateImpact({ ...common, test, updateWindows: [] })?.verdict).toBe('negative');
  });

  it('returns null without usable history', () => {
    expect(estimateImpact({ ...common, test: baseTest.slice(1), market: null, updateWindows: [] })).toBeNull();
    expect(estimateImpact({ ...common, test: baseTest, market: null, updateWindows: [], interventionDate: '2026-03-05' })).toBeNull();
    expect(estimateImpact({ ...common, test: baseTest, market: null, updateWindows: [], interventionDate: '2026-04-01' })).toBeNull();
  });

  it('keeps a zero expected post level explicitly unavailable as a relative ratio', () => {
    const out = estimateImpact({ ...common, control: days.map(() => 0), test: [...days.slice(0, 27).map(() => 0), 1], updateWindows: [] });
    expect(out?.relativeEffect).toBeNull();
  });

  it('falls back to raw series for an invalid market series and handles constant control', () => {
    const bad = days.map(() => 0);
    expect(estimateImpact({ ...common, test: baseTest, market: bad, updateWindows: [] })).toMatchObject({ marketNormalized: false, verdict: 'inconclusive', reason: 'market-unavailable' });
    const flat = estimateImpact({ ...common, control: days.map(() => 10), test: baseTest, market: null, marketSource: null, updateWindows: [] });
    expect(flat?.verdict).toBeDefined();
  });

  it('does not expose a causal verdict without an external market or independent control', () => {
    const noMarket = estimateImpact({ ...common, test: baseTest, market: null, marketSource: null, updateWindows: [] });
    expect(noMarket).toMatchObject({ verdict: 'inconclusive', reason: 'market-unavailable', marketNormalized: false });
    const unnamedMarket = estimateImpact({ ...common, test: baseTest, marketSource: null, updateWindows: [] });
    expect(unnamedMarket).toMatchObject({ verdict: 'inconclusive', reason: 'market-unavailable', marketNormalized: false });
    const sameSite = estimateImpact({ ...common, test: baseTest, controlIndependent: false, updateWindows: [] });
    expect(sameSite).toMatchObject({ verdict: 'inconclusive', reason: 'control-unavailable' });
    expect(sameSite?.controlSource).toBeNull();
  });
});

describe('normalizeByMarket', () => {
  it('scales by relative market level and rejects bad input', () => {
    expect(normalizeByMarket([10, 20, 10], [100, 50, 100], 1)).toEqual([10, 40, 10]);
    expect(normalizeByMarket([1], [1, 2], 1)).toBeNull();
    expect(normalizeByMarket([1], [1], 0)).toBeNull();
    expect(normalizeByMarket([Number.NaN], [1], 1)).toBeNull();
    expect(alignMarketObservations(['2026-01-01', '2026-01-02'], [
      { date: '2026-01-02', level: 2 }, { date: '2026-01-01', level: 1 },
    ])).toEqual([1, 2]);
    expect(alignMarketObservations(['2026-01-01', '2026-01-02'], [{ date: '2026-01-01', level: 1 }])).toBeNull();
    expect(alignMarketObservations(['2026-01-01'], [{ date: '2026-01-01', level: 0 }])).toBeNull();
  });
  it('finds dates in windows', () => {
    expect(datesInWindows(['2026-01-01', '2026-01-05'], [{ start: '2026-01-04', end: '2026-01-06' }])).toEqual(['2026-01-05']);
  });
});
