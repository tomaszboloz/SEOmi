export interface UpdateWindow {
  /** Inclusive ISO dates (YYYY-MM-DD) of a confirmed Google update rollout. End is null for ongoing rollouts. */
  start: string;
  end: string | null;
  label?: string;
  source?: string;
}

export interface DatedMarketObservation { date: string; level: number }

const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Aligns a dated external source to the GSC observation dates without filling gaps. */
export const alignMarketObservations = (dates: string[], observations: DatedMarketObservation[]): number[] | null => {
  const levels = new Map(observations.map(observation => [observation.date, observation.level]));
  const aligned = dates.map(date => levels.get(date));
  return aligned.every((level): level is number => level !== undefined && Number.isFinite(level) && level > 0) ? aligned : null;
};

/**
 * Divides a series by the market level relative to its pre-period mean, so a market-wide shock
 * (Core Update, SERP volatility) no longer moves the series. `market` is any positive level index.
 */
export const normalizeByMarket = (values: number[], market: number[], preLength: number): number[] | null => {
  const base = market.slice(0, preLength);
  if (values.length !== market.length || !Number.isInteger(preLength) || preLength < 1 || base.length === 0
    || values.some(value => !Number.isFinite(value)) || market.some((level) => !(level > 0) || !Number.isFinite(level))) return null;
  const reference = mean(base);
  return values.map((value, index) => value / (market[index] / reference));
};

/** Dates inside any update window; ISO strings compare correctly as text. */
export const datesInWindows = (dates: string[], windows: UpdateWindow[]): string[] =>
  dates.filter((date) => windows.some((window) => date >= window.start && (window.end === null || date <= window.end)));
