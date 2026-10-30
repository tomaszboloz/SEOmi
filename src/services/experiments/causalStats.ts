/** Small numeric helpers for the counterfactual model (#97). Pure, no dependencies. */

export const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Abramowitz-Stegun 7.1.26 erf; max error 1.5e-7, enough for reporting a probability with two decimals. */
const erf = (x: number): number => {
  const sign = x < 0 ? -1 : 1;
  const value = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * value);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - poly * Math.exp(-value * value));
};

export const normalCdf = (x: number): number => 0.5 * (1 + erf(x / Math.SQRT2));

/** Two-sided 95% Student t quantile via the Cornish-Fisher expansion (accurate to ~1e-3 for df >= 5). */
export const t975 = (df: number): number => {
  const z = 1.959964;
  const d = Math.max(1, df);
  return z + (z ** 3 + z) / (4 * d) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * d * d);
};

export interface LinearFit { intercept: number; slope: number; sd: number; n: number; xMean: number; sxx: number; r2: number; residuals: number[] }

/** Ordinary least squares y = a + b x. Null when x has no variance (a control without signal cannot explain y). */
export const fitLinear = (x: readonly number[], y: readonly number[]): LinearFit | null => {
  const n = x.length;
  if (n < 3 || y.length !== n) return null;
  const xMean = mean(x);
  const yMean = mean(y);
  const sxx = x.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  if (sxx === 0) return null;
  const slope = x.reduce((sum, value, i) => sum + (value - xMean) * (y[i] - yMean), 0) / sxx;
  const intercept = yMean - slope * xMean;
  const residuals = x.map((value, i) => y[i] - (intercept + slope * value));
  const sse = residuals.reduce((sum, value) => sum + value * value, 0);
  const sst = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  return { intercept, slope, sd: Math.sqrt(sse / (n - 2)), n, xMean, sxx, r2: sst === 0 ? 0 : 1 - sse / sst, residuals };
};

/** Lag-1 autocorrelation of residuals, clamped to [0, 0.9]; used to widen intervals for serially correlated days. */
export const lag1 = (residuals: readonly number[]): number => {
  if (residuals.length < 3) return 0;
  const avg = mean(residuals);
  const denominator = residuals.reduce((sum, value) => sum + (value - avg) ** 2, 0);
  if (denominator === 0) return 0;
  const numerator = residuals.slice(1).reduce((sum, value, i) => sum + (value - avg) * (residuals[i] - avg), 0);
  return Math.min(0.9, Math.max(0, numerator / denominator));
};

/**
 * Cumulative prediction error of `post` days: Var(sum(y - yhat)) = s^2 (m + m^2/n + (sum(x - xbar))^2 / Sxx),
 * inflated by (1 + rho) / (1 - rho) for positive residual autocorrelation.
 */
export const cumulativeSd = (fit: LinearFit, post: readonly number[], rho: number): number => {
  const m = post.length;
  const spread = post.reduce((sum, value) => sum + (value - fit.xMean), 0);
  const variance = fit.sd ** 2 * (m + (m * m) / fit.n + (spread * spread) / fit.sxx);
  return Math.sqrt(variance * ((1 + rho) / (1 - rho)));
};

export const pointSd = (fit: LinearFit, x: number): number => fit.sd * Math.sqrt(1 + 1 / fit.n + (x - fit.xMean) ** 2 / fit.sxx);
