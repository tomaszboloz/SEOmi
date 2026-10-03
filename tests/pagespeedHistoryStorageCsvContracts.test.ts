import { beforeEach, expect, it, vi } from 'vitest';
import { storageKey, makeSnapshotId, createPageSpeedSnapshot, savePageSpeedSnapshot, readPageSpeedSnapshots, clearPageSpeedSnapshots, pageSpeedHistoryStorageKey } from '@/services/pagespeedHistory/storage';
import { csvCell, pageSpeedHistoryCsv } from '@/services/pagespeedHistory/csv';
import { historySnapshot } from './fixtures/pageSpeedHistory';
beforeEach(() => { localStorage.clear(); vi.useRealTimers(); });
it('constructs stable project keys and unique opaque snapshot identities', () => {
  expect(storageKey('one')).toBe('seomi_project_one_pagespeed_history_v1'); expect(pageSpeedHistoryStorageKey('two')).not.toBe(storageKey('one'));
  const one = makeSnapshotId('date'), two = makeSnapshotId('date'); expect(one).not.toBe(two); expect(one.length).toBeGreaterThan(8); expect(one).not.toContain('date');
  const snapshot = createPageSpeedSnapshot({ url: ' https://site.test ', strategy: 'mobile', formFactor: 'PHONE', scope: 'url' });
  expect(snapshot).toMatchObject({ url: 'https://site.test', pageSpeed: null, crux: null }); expect(Number.isFinite(Date.parse(snapshot.capturedAt))).toBe(true);
});
it('persists supplied/current history, respects missing project, and clears only the selected project', () => {
  const one = historySnapshot(), two = historySnapshot({ id: 'other' });
  expect(savePageSpeedSnapshot(null, one)).toEqual([]); expect(savePageSpeedSnapshot(null, one, [two])).toEqual([two]); expect(readPageSpeedSnapshots(null)).toEqual([]);
  expect(savePageSpeedSnapshot('one', one, [two]).map(item => item.id)).toEqual(['observed', 'other']);
  expect(savePageSpeedSnapshot('one', historySnapshot({ id: 'third' }))).toHaveLength(3);
  savePageSpeedSnapshot('two', one); clearPageSpeedSnapshots(null); clearPageSpeedSnapshots('one');
  expect(readPageSpeedSnapshots('one')).toEqual([]); expect(readPageSpeedSnapshots('two')).toHaveLength(1);
});
it('escapes spreadsheet formulas and emits only observed sources and scores', () => {
  expect(csvCell(null)).toBe('""'); expect(csvCell('a"b')).toBe('"a""b"'); expect(csvCell(' \t=SUM(1)')).toBe('"\' \t=SUM(1)"');
  const csv = pageSpeedHistoryCsv([historySnapshot({ url: 'https://site.test/"quote' }), historySnapshot({ id: 'crux', pageSpeed: null }), historySnapshot({ id: 'psi', crux: null })]);
  expect(csv).toContain('"0","","100","50","PageSpeed + CrUX"'); expect(csv).toContain('"CrUX"'); expect(csv).toContain('"PageSpeed"');
  expect(csv.split('\r\n')).toHaveLength(4); expect(csv).toContain('"https://site.test/""quote"');
});
