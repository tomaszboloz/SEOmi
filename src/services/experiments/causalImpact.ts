import { cumulativeSd, fitLinear, lag1, normalCdf, pointSd, t975 } from './causalStats';

/**
 * Counterfactual estimate with a control series and uncertainty (#97). A regression of the test series on an
 * independently measured control over the pre-period predicts what the test series would have done without
 * the change. Frequentist approximation of Causal Impact (no BSTS, no seasonality component); it estimates an
 * association adjusted for the control, never certain causality.
 * Decision (default chosen by agent): pre >= 28 days, post >= 7 days, at most 10% missing days per window,
 * pre-period fit R² >= 0.5, and a placebo test on the second half of the pre-period must not find an effect;
 * otherwise the result is not estimable.
 */
export const CAUSAL_PROFILE = { minPreDays: 28, minPostDays: 7, maxMissingShare: 0.1, minR2: 0.5 } as const;

export type NotEstimableReason = 'short-pre-period' | 'short-post-period' | 'missing-data' | 'no-control' | 'flat-control' | 'poor-prefit' | 'placebo-failed';
export interface Interval { estimate: number; lower: number; upper: number }
export interface CausalEstimate {
  status: 'estimated' | 'not-estimable';
  reasons: NotEstimableReason[];
  preDays: number;
  postDays: number;
  prefit: { r2: number; residualSd: number; autocorrelation: number } | null;
  counterfactual: Array<{ date: string; actual: number; expected: number; lower: number; upper: number }>;
  /** Cumulative actual minus expected over the post-period. */
  absolute: Interval | null;
  /** Absolute effect divided by the cumulative expected value; null when that is not positive. */
  relative: Interval | null;
  /** One-sided probability that the effect has the observed sign (normal approximation, not a Bayesian posterior). */
  probability: number | null;
  placebo: { absolute: Interval; detected: boolean } | null;
}

export interface CausalInput { dates: readonly string[]; test: readonly (number | null)[]; control: readonly (number | null)[] | null; interventionDate: string }

interface Window { x: number[]; y: number[]; dates: string[]; missing: number; total: number }
const windowOf = (input: CausalInput, inPost: boolean): Window => {
  const out: Window = { x: [], y: [], dates: [], missing: 0, total: 0 };
  input.dates.forEach((date, i) => {
    if ((date >= input.interventionDate) !== inPost) return;
    out.total += 1;
    const x = input.control?.[i];
    const y = input.test[i];
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) { out.missing += 1; return; }
    out.x.push(x); out.y.push(y); out.dates.push(date);
  });
  return out;
};

const effectOf = (pre: Pick<Window, 'x' | 'y'>, post: Pick<Window, 'x' | 'y'>) => {
  const fit = fitLinear(pre.x, pre.y);
  if (!fit) return null;
  const rho = lag1(fit.residuals);
  const expected = post.x.map((x) => fit.intercept + fit.slope * x);
  const effect = post.y.reduce((sum, y, i) => sum + y - expected[i], 0);
  const sd = cumulativeSd(fit, post.x, rho);
  const half = t975(fit.n - 2) * sd;
  return { fit, rho, expected, sd, absolute: { estimate: effect, lower: effect - half, upper: effect + half } };
};

export const estimateCausalImpact = (input: CausalInput): CausalEstimate => {
  const pre = windowOf(input, false);
  const post = windowOf(input, true);
  const result: CausalEstimate = {
    status: 'not-estimable', reasons: [], preDays: pre.x.length, postDays: post.x.length,
    prefit: null, counterfactual: [], absolute: null, relative: null, probability: null, placebo: null,
  };
  if (!input.control) return { ...result, reasons: ['no-control'] };
  if (pre.x.length < CAUSAL_PROFILE.minPreDays) result.reasons.push('short-pre-period');
  if (post.x.length < CAUSAL_PROFILE.minPostDays) result.reasons.push('short-post-period');
  if ([pre, post].some((w) => w.total > 0 && w.missing / w.total > CAUSAL_PROFILE.maxMissingShare)) result.reasons.push('missing-data');
  if (result.reasons.length) return result;
  const main = effectOf(pre, post);
  if (!main) return { ...result, reasons: ['flat-control'] };
  result.prefit = { r2: main.fit.r2, residualSd: main.fit.sd, autocorrelation: main.rho };
  const half = Math.floor(pre.x.length / 2);
  const placebo = effectOf({ x: pre.x.slice(0, half), y: pre.y.slice(0, half) }, { x: pre.x.slice(half), y: pre.y.slice(half) });
  if (placebo) result.placebo = { absolute: placebo.absolute, detected: placebo.absolute.lower > 0 || placebo.absolute.upper < 0 };
  if (main.fit.r2 < CAUSAL_PROFILE.minR2) result.reasons.push('poor-prefit');
  if (result.placebo?.detected) result.reasons.push('placebo-failed');
  const t = t975(main.fit.n - 2);
  result.counterfactual = post.dates.map((date, i) => {
    const spread = t * pointSd(main.fit, post.x[i]);
    return { date, actual: post.y[i], expected: main.expected[i], lower: main.expected[i] - spread, upper: main.expected[i] + spread };
  });
  if (result.reasons.length) return result;
  const total = main.expected.reduce((sum, value) => sum + value, 0);
  result.absolute = main.absolute;
  result.relative = total > 0 ? { estimate: main.absolute.estimate / total, lower: main.absolute.lower / total, upper: main.absolute.upper / total } : null;
  result.probability = main.sd > 0 ? normalCdf(Math.abs(main.absolute.estimate) / main.sd) : null;
  result.status = 'estimated';
  return result;
};
