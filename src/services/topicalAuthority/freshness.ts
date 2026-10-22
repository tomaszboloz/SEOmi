import type { AuthorityPage } from './context';
import type { FreshnessReport } from './types';

export const FRESH_DAYS = 365;
const DAY_MS = 86_400_000;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export const ageDays = (date: string, now: string): number => Math.floor((Date.parse(now) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);

/** Share of dated on-topic pages updated within a year; undated pages are left out, not counted as stale. */
export const measureFreshness = (pages: AuthorityPage[], now: string): FreshnessReport => {
  const dated = pages.filter((entry) => entry.date && Number.isFinite(Date.parse(entry.date)));
  const stale = dated.filter((entry) => ageDays(entry.date as string, now) > FRESH_DAYS).map((entry) => entry.url).sort();
  return { ratio: dated.length ? round3(1 - stale.length / dated.length) : null, dated: dated.length, stale };
};
