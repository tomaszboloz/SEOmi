import { beforeEach, expect, it } from 'vitest';
import type { GscPerformanceData } from '@/types';
import { gscSnapshotStorageKey } from '@/services/gscTracker/limits';
import { readGscSnapshots, saveGscSnapshot } from '@/services/gscTracker/persistence';
import { gscSnapshotSchema } from '@/services/gscTracker/schema';
import { performanceDataOf } from '@/services/urlTelemetry/fromGscSnapshots';
import { gscData, memoryGscStorage } from './fixtures/gscTracker';

const row = (date = '2026-07-01') => ({ date, clicks: 0, impressions: 10, ctr: 0, position: 2 });
beforeEach(() => localStorage.clear());

it.each([false, true])('round-trips sorted daily observations and truncation=%s', truncated => {
  const source = gscData({ daily: [row('2026-07-02'), row()], daily_may_be_truncated: truncated });
  const { snapshot } = saveGscSnapshot('p', source);
  expect(snapshot.daily).toEqual([row(), row('2026-07-02')]);
  expect(snapshot.daily_may_be_truncated).toBe(truncated);
  expect(source.daily.map(item => item.date)).toEqual(['2026-07-02', '2026-07-01']);
  source.daily[0].clicks = 99;
  expect(snapshot.daily?.[1].clicks).toBe(0);
  expect(readGscSnapshots('p')[0]).toEqual(snapshot);
  expect(performanceDataOf(snapshot)).toMatchObject({ daily: [row(), row('2026-07-02')], daily_may_be_truncated: truncated });
  expect(readGscSnapshots('q')).toEqual([]);
});

it.each([499, 500, 501])('bounds %s daily rows and explicitly marks clipping', count => {
  const daily = Array.from({ length: count }, (_, index) => row(
    new Date(Date.UTC(2024, 0, index + 1)).toISOString().slice(0, 10),
  ));
  const { snapshot } = saveGscSnapshot('p', gscData({ daily: [...daily].reverse() }));
  expect(snapshot.daily).toEqual(daily.slice(0, 500));
  expect(snapshot.daily_may_be_truncated).toBe(count > 500);
  expect(readGscSnapshots('p')[0].daily).toHaveLength(Math.min(count, 500));
});

it('keeps legacy snapshots loadable and daily unknown, even with a stray false flag', () => {
  const { snapshot } = saveGscSnapshot('p', gscData({ daily: [row()] }));
  delete snapshot.daily;
  delete snapshot.daily_may_be_truncated;
  localStorage.setItem(gscSnapshotStorageKey('p'), JSON.stringify([snapshot]));
  const legacy = readGscSnapshots('p')[0];
  expect(legacy.daily).toBeUndefined();
  expect(performanceDataOf(legacy)).toMatchObject({ daily: [], daily_may_be_truncated: true });
  expect(performanceDataOf({ ...legacy, daily_may_be_truncated: false }).daily_may_be_truncated).toBe(true);
});

it('distinguishes an observed empty series from absent daily and unknown truncation', () => {
  const { snapshot } = saveGscSnapshot('p', gscData());
  expect(performanceDataOf(snapshot)).toMatchObject({ daily: [], daily_may_be_truncated: false });
  delete snapshot.daily_may_be_truncated;
  expect(performanceDataOf(snapshot)).toMatchObject({ daily: [], daily_may_be_truncated: true });
  const source = gscData();
  Reflect.deleteProperty(source, 'daily');
  const absent = saveGscSnapshot('q', source).snapshot;
  expect(absent.daily).toBeUndefined();
  expect(absent.daily_may_be_truncated).toBeUndefined();
});

it('normalizes unsorted stored daily rows without mutating the input', () => {
  const { snapshot } = saveGscSnapshot('p', gscData({ daily: [row(), row('2026-07-02')] }));
  snapshot.daily!.reverse();
  const storage = memoryGscStorage(JSON.stringify([snapshot]));
  expect(readGscSnapshots('p', storage)[0].daily).toEqual([row(), row('2026-07-02')]);
  expect(snapshot.daily?.[0].date).toBe('2026-07-02');
});

it.each([
  { date: '2026-02-30' }, { date: '2026-02-29' }, { date: '2026-7-01' }, { date: '2026-07-01T00:00:00Z' },
  { date: '2026-13-01' }, { date: '' }, { clicks: -1 }, { impressions: -1 }, { ctr: Infinity },
  { position: NaN }, { clicks: '1' }, { impressions: undefined },
])('drops a corrupt daily snapshot while retaining valid history: %j', extra => {
  const { snapshot } = saveGscSnapshot('p', gscData({ daily: [row()] }));
  const corrupt = { ...snapshot, daily: [{ ...row(), ...extra }] };
  const storage = memoryGscStorage(JSON.stringify([corrupt, snapshot]));
  expect(readGscSnapshots('p', storage)).toEqual([snapshot]);
  expect(gscSnapshotSchema.safeParse(corrupt).success).toBe(false);
});

it.each([null, {}, 'daily', Array.from({ length: 501 }, () => row())])('rejects invalid daily arrays: %j', daily => {
  const { snapshot } = saveGscSnapshot('p', gscData());
  expect(gscSnapshotSchema.safeParse({ ...snapshot, daily }).success).toBe(false);
});

it('rejects a non-boolean stored truncation flag and accepts calendar-valid leap dates', () => {
  const { snapshot } = saveGscSnapshot('p', gscData({ daily: [row('2024-02-29')] }));
  expect(gscSnapshotSchema.safeParse({ ...snapshot, daily_may_be_truncated: 'false' }).success).toBe(false);
  expect(readGscSnapshots('p')[0].daily?.[0].date).toBe('2024-02-29');
});

it('does not change ids or dedupe identity when daily data changes', () => {
  const storage = memoryGscStorage();
  const first = saveGscSnapshot('p', gscData(), storage, '2026-07-29T00:00:00Z');
  const data: GscPerformanceData = gscData({ daily: [row()] });
  const next = saveGscSnapshot('p', data, storage, '2026-07-30T00:00:00Z');
  expect(next.snapshot.id).toBe('sc-domain:example.com|2026-07-01|2026-07-28|{}');
  expect(next.snapshot.id).toBe(first.snapshot.id);
  expect(next.snapshots).toEqual([next.snapshot]);
  expect(readGscSnapshots('p', storage)[0].daily).toEqual([row()]);
});
