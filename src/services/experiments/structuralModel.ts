import { mean } from './causalStats';

/**
 * Structural time-series core for the counterfactual (#97): a local-level (random-walk) trend plus fixed
 * weekly seasonality, filtered with a scalar Kalman filter. This is a BSTS-style model with a deterministic,
 * seeded posterior-predictive simulation; it is not a full Bayesian fit (no spike-and-slab regression, no MCMC).
 * Variances come from the first-difference autocovariances of the deseasonalised pre-period.
 */
export interface StructuralFit { seasonal: number[]; level: number; levelVariance: number; observationVariance: number; trendVariance: number; fitted: number[] }

const DAY = 86_400_000;
export const weekday = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY) % 7;

/** Weekday effects: deviation from the overall mean, centred so they sum to zero. */
const seasonalFactors = (dates: readonly string[], y: readonly number[]): number[] => {
  const sums = new Array<number>(7).fill(0);
  const counts = new Array<number>(7).fill(0);
  const overall = mean(y);
  dates.forEach((date, i) => { sums[weekday(date)] += y[i] - overall; counts[weekday(date)] += 1; });
  const raw = sums.map((sum, day) => (counts[day] ? sum / counts[day] : 0));
  const shift = mean(raw);
  return raw.map((value) => value - shift);
};

export const fitStructural = (dates: readonly string[], y: readonly number[]): StructuralFit => {
  const seasonal = seasonalFactors(dates, y);
  const z = y.map((value, i) => value - seasonal[weekday(dates[i])]);
  const diffs = z.slice(1).map((value, i) => value - z[i]);
  const gamma = (lag: number) => diffs.slice(lag).reduce((sum, value, i) => sum + value * diffs[i], 0) / diffs.length;
  const observationVariance = Math.max(-gamma(1), 1e-6);
  const trendVariance = Math.max(gamma(0) - 2 * observationVariance, 0);
  let level = z[0];
  let levelVariance = observationVariance;
  const fitted: number[] = [];
  z.forEach((value, i) => {
    const predicted = levelVariance + (i ? trendVariance : 0);
    fitted.push(level + seasonal[weekday(dates[i])]);
    const gain = predicted / (predicted + observationVariance);
    level += gain * (value - level);
    levelVariance = (1 - gain) * predicted;
  });
  return { seasonal, level, levelVariance, observationVariance, trendVariance, fitted };
};

const lcg = (seed: number) => { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return (state + 1) / 2 ** 32; }; };
const gaussian = (next: () => number) => Math.sqrt(-2 * Math.log(next())) * Math.cos(2 * Math.PI * next());

export interface Forecast { expected: number[]; lower: number[]; upper: number[]; cumulative: number[] }

/** Seeded posterior-predictive paths: 95% bands per day and the sorted cumulative totals of every path. */
export const forecastStructural = (fit: StructuralFit, dates: readonly string[], draws = 1000, seed = 20261101): Forecast => {
  const next = lcg(seed);
  const paths = Array.from({ length: draws }, () => {
    let level = fit.level + Math.sqrt(fit.levelVariance) * gaussian(next);
    return dates.map((date) => {
      level += Math.sqrt(fit.trendVariance) * gaussian(next);
      return level + fit.seasonal[weekday(date)] + Math.sqrt(fit.observationVariance) * gaussian(next);
    });
  });
  const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(q * values.length))];
  const column = (i: number) => paths.map((path) => path[i]);
  return {
    expected: dates.map((_, i) => mean(column(i))), lower: dates.map((_, i) => quantile(column(i), 0.025)),
    upper: dates.map((_, i) => quantile(column(i), 0.975)), cumulative: paths.map((path) => path.reduce((sum, value) => sum + value, 0)).sort((a, b) => a - b),
  };
};
