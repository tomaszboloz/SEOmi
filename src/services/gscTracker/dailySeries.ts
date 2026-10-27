import { z } from 'zod';
import type { GscPerformanceData } from '@/types';
import type { GscDateRange, GscPerformanceSnapshot } from './types';

type DailyObservation = Pick<GscPerformanceData['daily'][number], 'date' | 'clicks' | 'impressions'>;
export interface GscDailySeries {
  daily: DailyObservation[];
  missingDates: string[];
}

export const dailySeriesOf = (snapshots: GscPerformanceSnapshot[], range: GscDateRange): GscDailySeries => {
  const dateSchema = z.iso.date();
  if (!dateSchema.safeParse(range.startDate).success || !dateSchema.safeParse(range.endDate).success
    || range.startDate > range.endDate) throw new RangeError('Invalid daily series date range.');

  const observations = new Map<string, DailyObservation>();
  const newestFirst = [...snapshots].sort((left, right) => Date.parse(right.captured_at) - Date.parse(left.captured_at));
  for (const snapshot of newestFirst) {
    for (const row of snapshot.daily ?? []) {
      if (row.date < range.startDate || row.date > range.endDate || observations.has(row.date)) continue;
      observations.set(row.date, { date: row.date, clicks: row.clicks, impressions: row.impressions });
    }
  }

  const result: GscDailySeries = { daily: [], missingDates: [] };
  const end = Date.parse(`${range.endDate}T00:00:00Z`);
  for (let time = Date.parse(`${range.startDate}T00:00:00Z`); time <= end; time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    const observation = observations.get(date);
    if (observation) result.daily.push(observation);
    else result.missingDates.push(date);
  }
  return result;
};
