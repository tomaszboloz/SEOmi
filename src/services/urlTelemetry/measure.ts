import type { Measure, MeasureState } from './types';

export const DAY_MS = 86_400_000;
export const FULL_WINDOW_DAYS = 90;
export const DEFAULT_MAX_AGE_DAYS = 7;

export const missing = <T>(state: MeasureState = 'unavailable', note?: string): Measure<T> => ({ state, value: null, ...(note ? { note } : {}) });

export const measured = <T>(value: T, state: MeasureState = 'measured', note?: string): Measure<T> => ({ state, value, ...(note ? { note } : {}) });

export const periodDays = (start: string, end: string): number => {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / DAY_MS) + 1 : 0;
};

/** Stale beats partial; fewer than 90 days is partial. Never claims a full window from a fragment. */
export const windowState = (start: string, end: string, now: Date, maxAgeDays = DEFAULT_MAX_AGE_DAYS): MeasureState => {
  const days = periodDays(start, end);
  if (!days) return 'unavailable';
  const age = (now.getTime() - Date.parse(`${end}T00:00:00Z`)) / DAY_MS;
  if (age > maxAgeDays) return 'stale';
  return days < FULL_WINDOW_DAYS ? 'partial-history' : 'measured';
};
