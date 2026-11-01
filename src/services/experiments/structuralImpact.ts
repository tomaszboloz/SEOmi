import { CAUSAL_PROFILE, type CausalEstimate, type CausalInput, type Interval } from './causalImpact';
import { fitLinear, mean } from './causalStats';
import { fitStructural, forecastStructural } from './structuralModel';

/**
 * Counterfactual with weekly seasonality (#97 D01). Same inputs, limits and not-estimable reasons as the
 * regression estimator; the control (when present and informative) is regressed out first and the residual is
 * modelled with a local level plus weekly seasonality. Credible intervals are quantiles of seeded posterior-predictive
 * paths, and `probability` is the share of paths whose cumulative effect has the observed sign.
 */
const point = (cumulative: number[], actual: number): Interval => {
  const at = (q: number) => actual - cumulative[Math.min(cumulative.length - 1, Math.floor(q * cumulative.length))];
  return { estimate: actual - mean(cumulative), lower: at(0.975), upper: at(0.025) };
};

interface Rows { dates: string[]; y: number[]; x: number[] }
const rowsOf = (input: CausalInput, post: boolean): Rows & { total: number } => {
  const rows = { dates: [] as string[], y: [] as number[], x: [] as number[], total: 0 };
  input.dates.forEach((date, i) => {
    if ((date >= input.interventionDate) !== post) return;
    rows.total += 1;
    const y = input.test[i];
    const x = input.control?.[i] ?? 0;
    if (y == null || !Number.isFinite(y) || !Number.isFinite(x)) return;
    Object.assign(rows, { dates: [...rows.dates, date], y: [...rows.y, y], x: [...rows.x, x] });
  });
  return rows;
};

const effect = (pre: Rows, post: Rows, adjust: boolean) => {
  const fit = adjust ? fitLinear(pre.x, pre.y) : null;
  const slope = fit?.slope ?? 0;
  const model = fitStructural(pre.dates, pre.y.map((value, i) => value - slope * pre.x[i]));
  const forecast = forecastStructural(model, post.dates);
  const shift = post.x.reduce((sum, value) => sum + slope * value, 0);
  const cumulative = forecast.cumulative.map((value) => value + shift);
  const actual = post.y.reduce((sum, value) => sum + value, 0);
  return { model, forecast, shift, slope, cumulative, actual, absolute: point(cumulative, actual) };
};

export const estimateStructuralImpact = (input: CausalInput): CausalEstimate => {
  const pre = rowsOf(input, false);
  const post = rowsOf(input, true);
  const result: CausalEstimate = { status: 'not-estimable', reasons: [], preDays: pre.y.length, postDays: post.y.length, prefit: null, counterfactual: [], absolute: null, relative: null, probability: null, placebo: null };
  if (pre.y.length < CAUSAL_PROFILE.minPreDays) result.reasons.push('short-pre-period');
  if (post.y.length < CAUSAL_PROFILE.minPostDays) result.reasons.push('short-post-period');
  if ([pre, post].some((w) => w.total > 0 && 1 - w.y.length / w.total > CAUSAL_PROFILE.maxMissingShare)) result.reasons.push('missing-data');
  if (result.reasons.length) return result;
  const adjust = !!input.control && fitLinear(pre.x, pre.y) !== null;
  const main = effect(pre, post, adjust);
  const half = Math.floor(pre.y.length / 2);
  const slice = (rows: Rows, from: number, to?: number): Rows => ({ dates: rows.dates.slice(from, to), y: rows.y.slice(from, to), x: rows.x.slice(from, to) });
  const placebo = effect(slice(pre, 0, half), slice(pre, half), adjust).absolute;
  result.placebo = { absolute: placebo, detected: placebo.lower > 0 || placebo.upper < 0 };
  const errors = main.model.fitted.map((value, i) => pre.y[i] - main.slope * pre.x[i] - value);
  const total = pre.y.reduce((sum, value) => sum + (value - mean(pre.y)) ** 2, 0);
  result.prefit = { r2: total === 0 ? 0 : Math.max(0, 1 - errors.reduce((s, e) => s + e * e, 0) / total), residualSd: Math.sqrt(main.model.observationVariance), autocorrelation: 0 };
  if (result.placebo.detected) result.reasons.push('placebo-failed');
  result.counterfactual = post.dates.map((date, i) => ({ date, actual: post.y[i], expected: main.forecast.expected[i] + main.slope * post.x[i], lower: main.forecast.lower[i] + main.slope * post.x[i], upper: main.forecast.upper[i] + main.slope * post.x[i] }));
  if (result.reasons.length) return result;
  const expectedTotal = mean(main.cumulative);
  result.absolute = main.absolute;
  result.relative = expectedTotal > 0 ? { estimate: main.absolute.estimate / expectedTotal, lower: main.absolute.lower / expectedTotal, upper: main.absolute.upper / expectedTotal } : null;
  const positive = main.cumulative.filter((value) => main.actual > value).length / main.cumulative.length;
  result.probability = main.absolute.estimate >= 0 ? positive : 1 - positive;
  result.status = 'estimated';
  return result;
};
