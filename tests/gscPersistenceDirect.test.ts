import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readGscSnapshots, saveGscSnapshot, snapshotGscPerformance, gscSnapshotStorageKey } from '@/services/gscPerformanceTracker';
import * as storageService from '@/services/storage';
import { gscSnapshotSchema } from '@/services/gscTracker/schema';
import { gscData, memoryGscStorage } from './fixtures/gscTracker';
import i18n from '@/i18n';
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it.each(['null', '{}', '"text"', '{bad'])('drops malformed/non-array history %s', value => {
  expect(readGscSnapshots('p', memoryGscStorage(value))).toEqual([]);
});
it('handles missing and inaccessible storage', () => {
  expect(readGscSnapshots('p', { getItem: () => null })).toEqual([]);
  expect(readGscSnapshots('p', { getItem: () => { throw new Error('denied'); } })).toEqual([]);
});
it('bounds history at eight independently parsed snapshots', () => {
  const snapshot = snapshotGscPerformance(gscData());
  const storage = memoryGscStorage(JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ ...snapshot, id: String(i) }))));
  const rows = readGscSnapshots('p', storage);
  expect(rows.map(row => row.id)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
  expect(rows[0].queries).not.toBe(rows[1].queries);
});
it('replaces only the same property/period/normalized filters and preserves other snapshots', () => {
  const source = gscData({ filters: { country: 'POL' } });
  const storage = memoryGscStorage();
  saveGscSnapshot('p', source, storage, 'first');
  const other = saveGscSnapshot('p', gscData({ site_url: 'sc-domain:other.com' }), storage, 'other');
  const replaced = saveGscSnapshot('p', { ...source, total_clicks: 5, filters: { country: ' pol ' } }, storage, 'new');
  expect(replaced.snapshots).toHaveLength(2);
  expect(replaced.snapshot.total_clicks).toBe(5);
  expect(replaced.snapshots[1]).toEqual(other.snapshot);
  expect(readGscSnapshots('p', storage)).toEqual(replaced.snapshots);
});
it('retains different periods and filter scopes under the eight-snapshot cap', () => {
  const storage = memoryGscStorage();
  for (let i = 1; i <= 10; i++) saveGscSnapshot('p', gscData({ start_date: `2026-07-${String(i).padStart(2, '0')}` }), storage);
  expect(readGscSnapshots('p', storage)).toHaveLength(8);
  const result = saveGscSnapshot('p', gscData({ filters: { device: 'MOBILE' } }), storage);
  expect(result.snapshots).toHaveLength(8);
  expect(result.snapshots[0].filters).toEqual({ device: 'MOBILE' });
});
it('rejects empty project identity before accessing storage', () => {
  const storage = { getItem: vi.fn(), setItem: vi.fn() };
  expect(() => saveGscSnapshot(' ', gscData(), storage)).toThrow(i18n.t('runtimeErrors.schedules.projectRequired'));
  expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
});
it.each([undefined, new Error('quota')])('reports default storage failure %s', error => {
  vi.spyOn(storageService, 'writeStorageResult').mockReturnValue({ ok: false, error });
  expect(() => saveGscSnapshot('p', gscData())).toThrow(error || i18n.t('runtimeErrors.gsc.unavailable'));
});
it('writes exact project keys and returns parsed snapshot ownership', () => {
  const storage = memoryGscStorage(); const write = vi.spyOn(storage, 'setItem');
  const data = gscData(); const result = saveGscSnapshot('p', data, storage, 'captured');
  expect(write).toHaveBeenCalledWith(gscSnapshotStorageKey('p'), JSON.stringify(result.snapshots));
  result.snapshot.queries[0].clicks = 1;
  expect(data.queries[0].clicks).toBe(100);
  expect(readGscSnapshots('p', storage)[0].queries[0].clicks).toBe(100);
});
it('directly validates complete shape and rejects mismatched stored counts', () => {
  const valid = snapshotGscPerformance(gscData());
  expect(gscSnapshotSchema.parse(valid)).toEqual(valid);
  expect(gscSnapshotSchema.safeParse({ ...valid, stored_page_rows: 9 }).success).toBe(false);
});
