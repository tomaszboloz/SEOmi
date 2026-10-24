import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendSerpSnapshot, decayStorageKey, loadSerpHistory, markSerpAlert, readSerpHistories,
  serpContextKey, SERP_HISTORY_EVENT,
} from '@/services/semanticDecay/snapshotStore';
import { historySnapshot } from './fixtures/decayHistory';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('project SERP history', () => {
  it('round-trips typed centroids, context normalization, and real ranked docs', () => {
    const snapshot = historySnapshot(0, { query: '  Ｑｕｅｒｙ \t test ', country: ' PL ', language: ' PL ' });
    expect(appendSerpSnapshot('p1', snapshot)).toBe(true);
    const loaded = loadSerpHistory('p1', { query: 'query test', country: 'pl', language: 'pl' });
    expect(loaded.snapshots[0].centroid).toEqual(new Float64Array([1, 0]));
    expect(loaded.snapshots[0].docs).toEqual(snapshot.docs);
    const raw = JSON.parse(localStorage.getItem(decayStorageKey('p1'))!);
    expect(raw[serpContextKey(snapshot)].snapshots[0].centroid).toEqual([1, 0]);
  });

  it('isolates projects, queries, countries, and languages without delimiter collisions', () => {
    for (const patch of [{}, { query: 'other' }, { country: 'US' }, { language: 'en' }]) appendSerpSnapshot('p1', historySnapshot(0, patch));
    appendSerpSnapshot('p2', historySnapshot(1));
    expect(Object.keys(readSerpHistories('p1'))).toHaveLength(4);
    expect(loadSerpHistory('p2').snapshots[0].id).toBe('snapshot-1');
    expect(loadSerpHistory('p1', { query: 'missing', country: 'PL', language: 'pl' }).snapshots).toEqual([]);
    expect(serpContextKey({ query: 'a|b', country: 'c', language: 'd' }))
      .not.toBe(serpContextKey({ query: 'a', country: 'b|c', language: 'd' }));
  });

  it('deduplicates observations and bounds chronological history to the latest 24', () => {
    for (let index = 29; index >= 0; index -= 1) appendSerpSnapshot('p1', historySnapshot(index));
    const history = loadSerpHistory('p1');
    expect(history.snapshots).toHaveLength(24);
    expect(history.snapshots[0].id).toBe('snapshot-6');
    expect(history.snapshots[23].id).toBe('snapshot-29');
    expect(appendSerpSnapshot('p1', historySnapshot(29))).toBe(false);
  });

  it('chooses the most recent multi-observation query, not a newer singleton', () => {
    appendSerpSnapshot('p1', historySnapshot(0));
    appendSerpSnapshot('p1', historySnapshot(1));
    appendSerpSnapshot('p1', historySnapshot(2, { query: 'second' }));
    appendSerpSnapshot('p1', historySnapshot(3, { query: 'second' }));
    appendSerpSnapshot('p1', historySnapshot(4, { query: 'singleton' }));
    expect(loadSerpHistory('p1').snapshots.map((snapshot) => snapshot.query)).toEqual(['second', 'second']);
    expect(loadSerpHistory('p1', historySnapshot()).snapshots).toHaveLength(2);
  });

  it('uses the latest singleton when no multi-observation query exists', () => {
    appendSerpSnapshot('p1', historySnapshot(0));
    appendSerpSnapshot('p1', historySnapshot(1, { query: 'latest', centroid: null }));
    expect(loadSerpHistory('p1').snapshots[0]).toMatchObject({ query: 'latest', centroid: null });
  });

  it('persists alerts per context and retains the cooldown when appending', () => {
    const snapshot = historySnapshot();
    appendSerpSnapshot('p1', snapshot);
    appendSerpSnapshot('p1', historySnapshot(1, { query: 'other' }));
    expect(markSerpAlert('p1', snapshot, '2026-10-24T12:00:00Z')).toBe(true);
    appendSerpSnapshot('p1', historySnapshot(2));
    expect(loadSerpHistory('p1', snapshot).lastAlertAt).toBe('2026-10-24T12:00:00Z');
    expect(loadSerpHistory('p1', { ...snapshot, query: 'other' }).lastAlertAt).toBeNull();
    expect(markSerpAlert('p1', snapshot, 'invalid')).toBe(false);
    expect(markSerpAlert('p1', { ...snapshot, query: 'absent' }, snapshot.takenAt)).toBe(false);
  });

  it('does not read or write an absent project', () => {
    expect(readSerpHistories(null)).toEqual({});
    expect(loadSerpHistory(null)).toEqual({ snapshots: [], lastAlertAt: null });
    expect(appendSerpSnapshot(null, historySnapshot())).toBe(false);
    expect(markSerpAlert(null, historySnapshot(), historySnapshot().takenAt)).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('rejects invalid writes and handles locked or full storage without throwing', () => {
    expect(appendSerpSnapshot('p1', historySnapshot(0, { takenAt: 'invalid' }))).toBe(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(appendSerpSnapshot('p1', historySnapshot())).toBe(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('locked'); });
    expect(loadSerpHistory('p1').snapshots).toEqual([]);
  });

  it('notifies mounted consumers only when a snapshot was actually saved', () => {
    const listener = vi.fn();
    window.addEventListener(SERP_HISTORY_EVENT, listener);
    appendSerpSnapshot('p1', historySnapshot());
    appendSerpSnapshot('p1', historySnapshot());
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toBe(decayStorageKey('p1'));
    window.removeEventListener(SERP_HISTORY_EVENT, listener);
  });
});
