import { datesInWindows, normalizeByMarket, type UpdateWindow } from './normalize';

export interface ImpactInput {
  /** ISO dates, ascending, one per observation. */
  dates: string[];
  test: number[];
  control: number[];
  /** Independent market level per date (e.g. SERP volatility for the niche, or independent control domains). Null when unavailable. */
  market: number[] | null;
  /** First date affected by the change. */
  interventionDate: string;
  updateWindows: UpdateWindow[];
}

export type ImpactVerdict = 'positive' | 'negative' | 'no-effect' | 'inconclusive';

export interface ImpactResult {
  /** Mean daily difference between actual and expected test value after the change. */
  effect: number;
  lower: number;
  upper: number;
  relativeEffect: number;
  marketNormalized: boolean;
  /** Post-period overlaps a Google update window. */
  updateWindow: boolean;
  affectedDates: string[];
  verdict: ImpactVerdict;
}

const MIN_PRE = 7;
const Z95 = 1.96;
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Least squares test ~ a + b * control on the pre-period. */
const fit = (control: number[], test: number[]) => {
  const cx = mean(control);
  const cy = mean(test);
  const spread = control.reduce((sum, x) => sum + (x - cx) ** 2, 0);
  const slope = spread === 0 ? 0 : control.reduce((sum, x, i) => sum + (x - cx) * (test[i] - cy), 0) / spread;
  const intercept = cy - slope * cx;
  const residuals = control.map((x, i) => test[i] - (intercept + slope * x));
  const sd = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(1, control.length - 2));
  return { slope, intercept, sd };
};

/**
 * Counterfactual impact with market normalization. During a Google update window the verdict is always
 * 'inconclusive' (the numbers are still returned) so a market shock is never reported as success or failure.
 * Returns null when there is no usable history (fewer than 7 pre days, no post days, mismatched lengths).
 */
export const estimateImpact = (input: ImpactInput): ImpactResult | null => {
  const { dates, test, control, market, interventionDate, updateWindows } = input;
  const pre = dates.filter((date) => date < interventionDate).length;
  const post = dates.length - pre;
  if (test.length !== dates.length || control.length !== dates.length || pre < MIN_PRE || post < 1) return null;
  const normTest = market ? normalizeByMarket(test, market, pre) : null;
  const normControl = market ? normalizeByMarket(control, market, pre) : null;
  const usedTest = normTest && normControl ? normTest : test;
  const usedControl = normTest && normControl ? normControl : control;
  const { slope, intercept, sd } = fit(usedControl.slice(0, pre), usedTest.slice(0, pre));
  const diffs = usedControl.slice(pre).map((x, i) => usedTest[pre + i] - (intercept + slope * x));
  const effect = mean(diffs);
  const half = (Z95 * sd) / Math.sqrt(post);
  const expected = mean(usedControl.slice(pre).map((x) => intercept + slope * x));
  const affectedDates = datesInWindows(dates.slice(pre), updateWindows);
  const updateWindow = affectedDates.length > 0;
  const significant = effect - half > 0 || effect + half < 0;
  return {
    effect,
    lower: effect - half,
    upper: effect + half,
    relativeEffect: expected === 0 ? 0 : effect / expected,
    marketNormalized: Boolean(normTest && normControl),
    updateWindow,
    affectedDates,
    verdict: updateWindow ? 'inconclusive' : !significant ? 'no-effect' : effect > 0 ? 'positive' : 'negative',
  };
};
