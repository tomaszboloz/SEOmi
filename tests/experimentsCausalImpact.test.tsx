import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { CAUSAL_PROFILE, estimateCausalImpact, type CausalInput } from '@/services/experiments/causalImpact';
import { fitLinear, lag1, normalCdf, t975 } from '@/services/experiments/causalStats';
import { causalImpactFor } from '@/services/experiments/causalSeries';
import type { Intervention } from '@/services/experiments/registry';
import type { GscPerformanceSnapshot } from '@/services/gscTracker/types';
import { CausalImpactSection } from '@/components/Charts/experiments/CausalImpactSection';

const day = (i: number) => new Date(Date.UTC(2026, 6, 1) + i * 86_400_000).toISOString().slice(0, 10);
/** Deterministic pseudo-noise so tests have a known answer without randomness. */
const noise = (i: number) => ((i * 7919) % 13) - 6;
const series = (days: number, effectFrom: number | null, effect: number) => {
  const dates = Array.from({ length: days }, (_, i) => day(i));
  const control = dates.map((_, i) => 200 + 40 * Math.sin(i / 3) + noise(i));
  const test = control.map((c, i) => 0.5 * c + 20 + noise(i + 3) * 0.5 + (effectFrom !== null && i >= effectFrom ? effect : 0));
  return { dates, control, test };
};
const input = (days: number, effectFrom: number, effect: number, patch: Partial<CausalInput> = {}): CausalInput =>
  ({ ...series(days, effectFrom, effect), interventionDate: day(effectFrom), ...patch });

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('statistics helpers', () => {
  it('match known values', () => {
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 4);
    expect(t975(10)).toBeCloseTo(2.228, 2);
    expect(t975(1000)).toBeCloseTo(1.962, 2);
    expect(fitLinear([1, 2, 3], [3, 5, 7])).toMatchObject({ intercept: 1, slope: 2, r2: 1 });
    expect(fitLinear([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(fitLinear([1, 2], [1, 2])).toBeNull();
    expect(lag1([1, 2])).toBe(0);
    expect(lag1([1, 1, 1])).toBe(0);
    expect(lag1([1, 2, 3, 4, 5, 6])).toBeGreaterThan(0);
  });
});

describe('counterfactual estimate (#97)', () => {
  it('recovers a known effect with an interval and finds none in a null series', () => {
    const known = estimateCausalImpact(input(90, 60, 30));
    expect(known.status).toBe('estimated');
    expect(known.absolute!.estimate).toBeCloseTo(30 * 30, -2);
    expect(known.absolute!.lower).toBeGreaterThan(0);
    expect(known.relative!.estimate).toBeGreaterThan(0);
    expect(known.probability).toBeGreaterThan(0.99);
    expect(known.counterfactual).toHaveLength(30);
    expect(known.counterfactual[0].lower).toBeLessThan(known.counterfactual[0].expected);
    expect(known.placebo?.detected).toBe(false);
    const none = estimateCausalImpact(input(90, 60, 0));
    expect(none.status).toBe('estimated');
    expect(none.absolute!.lower).toBeLessThan(0);
    expect(none.absolute!.upper).toBeGreaterThan(0);
  });

  it('is not estimable without enough, complete or well-fitted data', () => {
    expect(estimateCausalImpact({ ...input(90, 60, 0), control: null }).reasons).toEqual(['no-control']);
    expect(estimateCausalImpact(input(40, CAUSAL_PROFILE.minPreDays - 1, 0)).reasons).toContain('short-pre-period');
    expect(estimateCausalImpact(input(64, 60, 0)).reasons).toEqual(['short-post-period']);
    const raw = series(90, 60, 0);
    const gappy = { ...raw, interventionDate: day(60) };
    expect(estimateCausalImpact({ ...gappy, test: gappy.test.map((value, i) => (i % 5 === 0 ? null : value)) }).reasons).toEqual(['missing-data']);
    expect(estimateCausalImpact({ ...gappy, control: gappy.control.map(() => 5) }).reasons).toEqual(['flat-control']);
    const unrelated = { ...gappy, test: gappy.test.map((_, i) => 100 + noise(i * 3) * 5) };
    const poor = estimateCausalImpact(unrelated);
    expect(poor.reasons).toContain('poor-prefit');
    expect(poor.absolute).toBeNull();
    const drift = { ...gappy, test: gappy.test.map((value, i) => value + (i >= 30 ? 25 : 0)) };
    expect(estimateCausalImpact(drift).reasons).toContain('placebo-failed');
    const zero = estimateCausalImpact({ ...gappy, test: raw.control.map((c) => c - 300) });
    expect(zero.relative).toBeNull();
  });
});

const snapshot = (site: string, values: number[], patch: Partial<GscPerformanceSnapshot> = {}): GscPerformanceSnapshot => ({
  site_url: site, start_date: day(0), end_date: day(values.length - 1), captured_at: '2026-10-01T00:00:00Z',
  daily: values.map((clicks, i) => ({ date: day(i), clicks, impressions: clicks * 10, ctr: 0.1, position: 5 })),
  ...patch,
} as GscPerformanceSnapshot);
const intervention = (url: string, date = day(60)): Intervention =>
  ({ id: 'e', projectId: 'p', url, date, kind: 'content', note: '', createdAt: '2026-10-01T00:00:00Z' });

describe('series selection for an intervention', () => {
  it('uses the project property as test and the best pre-period independent control', () => {
    const data = series(90, 60, 30);
    const snapshots = [
      snapshot('sc-domain:shop.test', data.test), snapshot('sc-domain:control.test', data.control),
      snapshot('sc-domain:other.test', data.control.map((_, i) => 50 + noise(i))), snapshot('https://www.shop.test/', data.control),
    ];
    const setup = causalImpactFor(intervention('site'), snapshots, 'https://shop.test/');
    expect(setup).toMatchObject({ testSite: 'sc-domain:shop.test', controlSite: 'sc-domain:control.test', unavailable: null });
    expect(setup.estimate?.status).toBe('estimated');
    expect(causalImpactFor(intervention('https://shop.test/a'), snapshots, 'https://shop.test/')).toMatchObject({ unavailable: 'page-series-unavailable', estimate: null });
    expect(causalImpactFor(intervention('site'), snapshots, undefined).unavailable).toBe('no-test-series');
    expect(causalImpactFor(intervention('site'), [snapshot('sc-domain:shop.test', data.test)], 'https://shop.test/').estimate?.reasons).toEqual(['no-control']);
  });
});

describe('CausalImpactSection', () => {
  it('renders estimates, reasons and unavailable states', () => {
    const data = series(90, 60, 30);
    const setup = causalImpactFor(intervention('site'), [snapshot('sc-domain:shop.test', data.test), snapshot('sc-domain:control.test', data.control)], 'https://shop.test/');
    render(<CausalImpactSection setup={setup} />);
    expect(screen.getByText(/Estimated from 60 pre-period and 30 post-period days/)).toBeTruthy();
    expect(screen.getByText(/Cumulative effect on clicks: \+/)).toBeTruthy();
    expect(screen.getByText(/Placebo test passed/)).toBeTruthy();
    expect(screen.getByText(/not a Bayesian posterior/)).toBeTruthy();
    cleanup();
    render(<CausalImpactSection setup={causalImpactFor(intervention('site'), [snapshot('sc-domain:shop.test', data.test)], 'https://shop.test/')} />);
    expect(screen.getByText(/control: none/)).toBeTruthy();
    expect(screen.getByText(/No independent control property/)).toBeTruthy();
    cleanup();
    render(<CausalImpactSection setup={{ testSite: null, controlSite: null, estimate: null, unavailable: 'page-series-unavailable' }} />);
    expect(screen.getByText(/Not estimable for a single URL/)).toBeTruthy();
  });
});
