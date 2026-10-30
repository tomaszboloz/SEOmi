import { estimateCausalImpact, type CausalEstimate, type CausalInput } from './causalImpact';

/**
 * Robustness policy for counterfactual estimates (#97 GEM-97-07, D01).
 * Backtest: the same model is re-run with pseudo-interventions inside the real pre-period, where no change
 * happened; an interval that excludes zero there is a false positive and the real estimate is not trusted.
 * Multiple comparisons: with several experiments shown at once, two-sided p-values are Holm-adjusted so one
 * "significant" result among many is not reported as an effect by chance.
 * Decision (default chosen by agent): pseudo-intervention offsets 14 and 21 days, alpha 0.05, Holm-Bonferroni.
 */
export const BACKTEST_OFFSETS_DAYS = [14, 21] as const;
export const FAMILY_ALPHA = 0.05;

export interface BacktestResult {
  status: 'passed' | 'failed' | 'not-estimable';
  /** Pseudo-interventions that could be estimated. */
  runs: number;
  falsePositives: number;
}

const shift = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const backtestCausal = (input: CausalInput, offsets: readonly number[] = BACKTEST_OFFSETS_DAYS): BacktestResult => {
  const keep = input.dates.map((date) => date < input.interventionDate);
  const pick = <T>(values: readonly T[]) => values.filter((_, index) => keep[index]);
  const estimates = offsets.map((offset) => estimateCausalImpact({
    dates: pick(input.dates), test: pick(input.test), control: input.control ? pick(input.control) : null,
    interventionDate: shift(input.interventionDate, -offset),
  })).filter((estimate) => estimate.status === 'estimated' && estimate.absolute);
  const falsePositives = estimates.filter((estimate) => estimate.absolute!.lower > 0 || estimate.absolute!.upper < 0).length;
  return { status: !estimates.length ? 'not-estimable' : falsePositives ? 'failed' : 'passed', runs: estimates.length, falsePositives };
};

/** Two-sided p-value from the one-sided sign probability; null when not estimated. */
export const twoSidedP = (estimate: CausalEstimate | null): number | null =>
  estimate?.status === 'estimated' && estimate.probability !== null ? Math.min(1, Math.max(0, 2 * (1 - estimate.probability))) : null;

export interface FamilyResult { adjustedP: number | null; significant: boolean; family: number }

/** Holm-Bonferroni step-down adjustment; entries without a p-value are not part of the family. */
export const holmAdjust = (pValues: ReadonlyArray<number | null>, alpha = FAMILY_ALPHA): FamilyResult[] => {
  const tested = pValues.map((p, index) => ({ p, index })).filter((item): item is { p: number; index: number } => item.p !== null && Number.isFinite(item.p));
  const m = tested.length;
  const adjusted = new Map<number, number>();
  let running = 0;
  [...tested].sort((a, b) => a.p - b.p || a.index - b.index).forEach((item, rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * item.p));
    adjusted.set(item.index, running);
  });
  return pValues.map((_, index) => {
    const value = adjusted.get(index);
    return value === undefined ? { adjustedP: null, significant: false, family: m } : { adjustedP: value, significant: value < alpha, family: m };
  });
};
