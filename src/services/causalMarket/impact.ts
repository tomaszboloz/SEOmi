import { datesInWindows, normalizeByMarket, type UpdateWindow } from './normalize';

export interface ImpactInput {
  /** ISO dates, ascending, one per observation. */
  dates: string[];
  test: number[];
  control: number[];
  /** Independent market level per date (e.g. SERP volatility for the niche, or independent control domains). Null when unavailable. */
  market: number[] | null;
  /** Provenance is required before a positive or negative causal verdict is exposed. */
  marketSource?: string | null;
  /** The control must be independently observed, with a named source. */
  controlSource?: string | null;
  controlIndependent?: boolean;
  /** First date affected by the change. */
  interventionDate: string;
  updateWindows?: UpdateWindow[] | null;
  updateFeedStatus?: 'available' | 'unavailable' | 'unknown';
}

export type ImpactVerdict = 'positive' | 'negative' | 'no-effect' | 'inconclusive';
export type ImpactReason = 'market-unavailable' | 'control-unavailable' | 'update-window';

export interface ImpactResult {
  /** Mean daily difference between actual and expected test value after the change. */
  effect: number;
  lower: number;
  upper: number;
  relativeEffect: number | null;
  marketNormalized: boolean;
  /** Post-period overlaps a Google update window, or update feed is unavailable/unknown. */
  updateWindow: boolean;
  updateFeedStatus?: 'available' | 'unavailable' | 'unknown';
  affectedDates: string[];
  verdict: ImpactVerdict;
  reason?: ImpactReason | null;
  marketSource?: string | null;
  controlSource?: string | null;
}

const MIN_PRE = 7;
const Z95 = 1.96;
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
const isVolatilitySource = (source?: string | null): boolean => Boolean(source && /volatilit/i.test(source));

/** Least squares test ~ a + b * control on the pre-period; proportional fallback when control has no variance. */
const fit = (control: number[], test: number[]) => {
  const cx = mean(control);
  const cy = mean(test);
  const spread = control.reduce((sum, x) => sum + (x - cx) ** 2, 0);
  const flat = spread === 0;
  const slope = flat ? (cx === 0 ? 0 : cy / cx) : control.reduce((sum, x, i) => sum + (x - cx) * (test[i] - cy), 0) / spread;
  const intercept = flat ? (cx === 0 ? cy : 0) : cy - slope * cx;
  const residuals = control.map((x, i) => test[i] - (intercept + slope * x));
  const sd = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(1, control.length - 2));
  return { slope, intercept, sd, flat };
};

/**
 * Counterfactual impact with market normalization or independent control baseline.
 * When update-feed evidence is unknown or an update window overlaps post-period,
 * verdict is 'inconclusive' to avoid false causal claims.
 */
export const estimateImpact = (input: ImpactInput): ImpactResult | null => {
  const { dates, test, control, market, interventionDate, updateWindows, updateFeedStatus, marketSource, controlSource, controlIndependent } = input;
  const pre = dates.filter((date) => date < interventionDate).length;
  const post = dates.length - pre;
  if (test.length !== dates.length || control.length !== dates.length || pre < MIN_PRE || post < 1) return null;

  const cx0 = mean(control.slice(0, pre));
  const controlReady = controlIndependent === true && Boolean(controlSource?.trim()) && cx0 !== 0;
  const volatility = isVolatilitySource(marketSource);
  const shouldNormalize = Boolean(market && !volatility);
  const normTest = shouldNormalize ? normalizeByMarket(test, market!, pre) : null;
  const normControl = shouldNormalize ? normalizeByMarket(control, market!, pre) : null;
  const marketReady = Boolean(market && marketSource?.trim() && (volatility || (normTest && normControl)));
  const usedTest = normTest ?? test;
  const usedControl = normControl ?? control;

  const { slope, intercept, sd } = fit(usedControl.slice(0, pre), usedTest.slice(0, pre));
  const diffs = usedControl.slice(pre).map((x, i) => usedTest[pre + i] - (intercept + slope * x));
  const effect = mean(diffs);
  const half = (Z95 * sd) / Math.sqrt(post);
  const expected = mean(usedControl.slice(pre).map((x) => intercept + slope * x));

  const windows = Array.isArray(updateWindows) ? updateWindows : [];
  const affectedDates = datesInWindows(dates.slice(pre), windows);
  const resolvedFeedStatus = updateFeedStatus ?? (updateWindows === null ? 'unavailable' : Array.isArray(updateWindows) ? 'available' : 'unknown');
  const feedUnconfirmed = resolvedFeedStatus === 'unavailable' || resolvedFeedStatus === 'unknown';
  const updateWindow = affectedDates.length > 0 || feedUnconfirmed;

  const reason: ImpactReason | null = affectedDates.length > 0 || resolvedFeedStatus === 'unavailable'
    ? 'update-window'
    : !controlReady
      ? 'control-unavailable'
      : !marketReady
        ? 'market-unavailable'
        : resolvedFeedStatus === 'unknown'
          ? 'update-window'
          : null;

  const significant = effect - half > 0 || effect + half < 0;

  return {
    effect,
    lower: effect - half,
    upper: effect + half,
    relativeEffect: expected === 0 || !Number.isFinite(expected) ? null : effect / expected,
    marketNormalized: Boolean(marketReady && !volatility),
    updateWindow,
    updateFeedStatus: resolvedFeedStatus,
    affectedDates,
    verdict: reason ? 'inconclusive' : !significant ? 'no-effect' : effect > 0 ? 'positive' : 'negative',
    reason,
    marketSource: marketReady ? marketSource! : null,
    controlSource: controlReady ? controlSource! : null,
  };
};
