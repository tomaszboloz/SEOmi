export interface UpdateWindow {
  /** Inclusive ISO dates (YYYY-MM-DD) of a confirmed Google update rollout. */
  start: string;
  end: string;
  label?: string;
}

const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Divides a series by the market level relative to its pre-period mean, so a market-wide shock
 * (Core Update, SERP volatility) no longer moves the series. `market` is any positive level index.
 */
export const normalizeByMarket = (values: number[], market: number[], preLength: number): number[] | null => {
  const base = market.slice(0, preLength);
  if (values.length !== market.length || base.length === 0 || market.some((level) => !(level > 0))) return null;
  const reference = mean(base);
  return values.map((value, index) => value / (market[index] / reference));
};

/** Dates inside any update window; ISO strings compare correctly as text. */
export const datesInWindows = (dates: string[], windows: UpdateWindow[]): string[] =>
  dates.filter((date) => windows.some((window) => date >= window.start && date <= window.end));
