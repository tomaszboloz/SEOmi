import { describe, expect, it } from 'vitest';
import { estimateStructuralImpact } from '@/services/experiments/structuralImpact';
import { fitStructural, forecastStructural, weekday } from '@/services/experiments/structuralModel';

const DAY = 86_400_000;
const dates = (start: string, count: number) => Array.from({ length: count }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * DAY).toISOString().slice(0, 10));
const noise = (seed: number) => { let s = seed; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s / 2 ** 32 - 0.5) * 6; }; };
const WEEK = [10, 12, 14, 13, 11, -25, -28];
const series = (days: string[], base: number, lift: number, change: string, seed: number, seasonal = true) => {
  const random = noise(seed);
  return days.map((date) => base + (seasonal ? WEEK[weekday(date)] : 0) + (date >= change ? lift : 0) + random());
};
const days = dates('2026-01-01', 70);
const CHANGE = '2026-02-26';

describe('structural counterfactual with weekly seasonality (#97)', () => {
  it('recovers a known lift on a seasonal series and brackets it with the interval', () => {
    const test = series(days, 100, 20, CHANGE, 1);
    const result = estimateStructuralImpact({ dates: days, test, control: null, interventionDate: CHANGE });
    expect(result.status).toBe('estimated');
    const postDays = result.postDays;
    expect(result.absolute!.estimate).toBeGreaterThan(20 * postDays * 0.7);
    expect(result.absolute!.estimate).toBeLessThan(20 * postDays * 1.3);
    expect(result.absolute!.lower).toBeGreaterThan(0);
    expect(result.probability!).toBeGreaterThan(0.95);
    expect(result.relative!.estimate).toBeGreaterThan(0.1);
    expect(result.counterfactual).toHaveLength(postDays);
    expect(result.prefit!.r2).toBeGreaterThan(0.5);
  });

  it('finds no effect on a flat seasonal series (interval covers zero)', () => {
    const result = estimateStructuralImpact({ dates: days, test: series(days, 100, 0, CHANGE, 2), control: null, interventionDate: CHANGE });
    expect(result.status).toBe('estimated');
    expect(result.absolute!.lower).toBeLessThan(0);
    expect(result.absolute!.upper).toBeGreaterThan(0);
  });

  it('uses an informative control, ignores a flat one, and reports a negative effect with its probability', () => {
    const control = series(days, 200, 0, CHANGE, 3);
    const test = control.map((value, i) => value / 2 + (days[i] >= CHANGE ? -15 : 0));
    const result = estimateStructuralImpact({ dates: days, test, control, interventionDate: CHANGE });
    expect(result.status).toBe('estimated');
    expect(result.absolute!.estimate).toBeLessThan(0);
    expect(result.probability!).toBeGreaterThan(0.9);
    const flat = estimateStructuralImpact({ dates: days, test: series(days, 100, 20, CHANGE, 1), control: days.map(() => 5), interventionDate: CHANGE });
    expect(flat.status).toBe('estimated');
  });

  it('is not estimable with short windows, missing days or a trend break before the change', () => {
    expect(estimateStructuralImpact({ dates: days.slice(30), test: series(days.slice(30), 100, 0, CHANGE, 4), control: null, interventionDate: CHANGE }).reasons).toContain('short-pre-period');
    expect(estimateStructuralImpact({ dates: days.slice(0, 60), test: series(days.slice(0, 60), 100, 0, CHANGE, 4), control: null, interventionDate: CHANGE }).reasons).toContain('short-post-period');
    const holes = series(days, 100, 0, CHANGE, 5).map((value, i) => (i % 3 === 0 ? null : value));
    expect(estimateStructuralImpact({ dates: days, test: holes, control: null, interventionDate: CHANGE }).reasons).toContain('missing-data');
    const drifting = days.map((date, i) => 100 + (date < CHANGE ? (i < 28 ? 0 : 60) : 60) + WEEK[weekday(date)]);
    const jump = estimateStructuralImpact({ dates: days, test: drifting, control: null, interventionDate: CHANGE });
    expect(jump.reasons).toEqual(['placebo-failed']);
    expect(jump.absolute).toBeNull();
  });

  it('handles a constant series, an empty relative base and non-finite control values', () => {
    const constant = estimateStructuralImpact({ dates: days, test: days.map(() => 0), control: null, interventionDate: CHANGE });
    expect(constant.relative).toBeNull();
    expect(constant.prefit!.r2).toBe(0);
    const bad = estimateStructuralImpact({ dates: days, test: series(days, 100, 0, CHANGE, 6), control: days.map((_, i) => (i === 3 ? Number.NaN : 1)), interventionDate: CHANGE });
    expect(bad.preDays).toBeLessThan(CHANGE.length * 100);
  });

  it('model primitives are deterministic and seasonal factors sum to zero', () => {
    const pre = days.slice(0, 56);
    const fit = fitStructural(pre, series(pre, 100, 0, CHANGE, 7));
    expect(fit.seasonal.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 8);
    expect(fit.seasonal[5]).toBeLessThan(fit.seasonal[2]);
    expect(forecastStructural(fit, days.slice(56))).toEqual(forecastStructural(fit, days.slice(56)));
    const gap = fitStructural(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'], [1, 2, 3, 4]);
    expect(gap.seasonal.some((value) => value === gap.seasonal[0])).toBe(true);
  });
});
