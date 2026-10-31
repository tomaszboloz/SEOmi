import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { estimateCausalImpact, type CausalEstimate, type CausalInput } from '@/services/experiments/causalImpact';
import { backtestCausal, holmAdjust, twoSidedP } from '@/services/experiments/causalPolicy';
import { CausalImpactSection } from '@/components/Charts/experiments/CausalImpactSection';

const day = (i: number) => new Date(Date.UTC(2026, 6, 1) + i * 86_400_000).toISOString().slice(0, 10);
const noise = (i: number) => ((i * 7919) % 13) - 6;
const series = (days: number, at: number, effect: number, preShift: number | null = null): CausalInput => {
  const dates = Array.from({ length: days }, (_, i) => day(i));
  const control = dates.map((_, i) => 200 + 40 * Math.sin(i / 3) + noise(i));
  const test = control.map((c, i) => 0.5 * c + 20 + noise(i + 3) * 0.5 + (i >= at ? effect : 0) + (preShift !== null && i >= preShift && i < at ? effect : 0));
  return { dates, control, test, interventionDate: day(at) };
};

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('backtest with pseudo-interventions (#97 GEM-97-07, T02)', () => {
  it('passes on a clean pre-period and fails when the pre-period already shifted', () => {
    expect(backtestCausal(series(120, 80, 40))).toEqual({ status: 'passed', runs: 2, falsePositives: 0 });
    const contaminated = backtestCausal(series(120, 80, 40, 62));
    expect(contaminated.status).toBe('failed');
    expect(contaminated.falsePositives).toBeGreaterThan(0);
  });

  it('is not estimable with a short pre-period or no control', () => {
    expect(backtestCausal(series(60, 30, 40)).status).toBe('not-estimable');
    expect(backtestCausal({ ...series(120, 80, 40), control: null })).toEqual({ status: 'not-estimable', runs: 0, falsePositives: 0 });
  });
});

describe('multiple-comparison policy (#97 D01)', () => {
  it('derives two-sided p-values only from estimated results', () => {
    expect(twoSidedP({ status: 'estimated', probability: 0.99 } as CausalEstimate)).toBeCloseTo(0.02);
    expect(twoSidedP({ status: 'not-estimable', probability: null } as CausalEstimate)).toBeNull();
    expect(twoSidedP(null)).toBeNull();
  });

  it('applies Holm step-down and leaves untested entries out of the family', () => {
    const result = holmAdjust([0.01, null, 0.04, 0.03]);
    expect(result.map((r) => r.family)).toEqual([3, 3, 3, 3]);
    expect(result[0]).toEqual({ adjustedP: 0.03, significant: true, family: 3 });
    expect(result[1]).toEqual({ adjustedP: null, significant: false, family: 3 });
    expect(result[3].adjustedP).toBeCloseTo(0.06);
    expect(result[2].adjustedP).toBeCloseTo(0.06);
    expect(result[2].significant).toBe(false);
    expect(holmAdjust([0.9, 0.8]).map((r) => r.adjustedP)).toEqual([1, 1]);
    expect(holmAdjust([])).toEqual([]);
  });

  it('shows backtest and family adjustment in the experiment card', () => {
    const estimate = estimateCausalImpact(series(120, 80, 40));
    const view = render(<CausalImpactSection setup={{ testSite: 'sc-domain:a.pl', controlSite: 'sc-domain:b.pl', estimate, unavailable: null,
      backtest: { status: 'failed', runs: 2, falsePositives: 1 }, family: { adjustedP: 0.2, significant: false, family: 3 } }} />);
    expect(screen.getByText(/1 of 2 pseudo-interventions/)).toBeTruthy();
    expect(screen.getByText(/Not significant after adjusting for 3 experiments/)).toBeTruthy();
    view.rerender(<CausalImpactSection setup={{ testSite: 'a', controlSite: null, estimate, unavailable: null, backtest: null, family: { adjustedP: 0.01, significant: true, family: 1 } }} />);
    expect(screen.queryByText(/adjusting for/)).toBeNull();
    view.rerender(<CausalImpactSection setup={{ testSite: 'a', controlSite: null, estimate, unavailable: null, family: { adjustedP: 0.01, significant: true, family: 2 } }} />);
    expect(screen.getByText(/Still significant after adjusting for 2/)).toBeTruthy();
  });
});
