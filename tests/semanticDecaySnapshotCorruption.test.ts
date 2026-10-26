import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appendSerpSnapshot, decayStorageKey, loadSerpHistory, readSerpHistories, serpContextKey } from '@/services/semanticDecay/snapshotStore';
import { serializeSerpSnapshot } from '@/services/semanticDecay/snapshotSchema';
import { historySnapshot } from './fixtures/decayHistory';

const write = (value: unknown) => localStorage.setItem(decayStorageKey('p1'), JSON.stringify(value));
const key = serpContextKey(historySnapshot());
beforeEach(() => { localStorage.clear(); });

describe('untrusted snapshot storage', () => {
  it.each([null, [], 42, 'invalid'])('drops an invalid root: %j', (value) => {
    write(value);
    expect(readSerpHistories('p1')).toEqual({});
  });

  it('drops malformed JSON and replaces it on the next valid write', () => {
    localStorage.setItem(decayStorageKey('p1'), '{');
    expect(loadSerpHistory('p1').snapshots).toEqual([]);
    expect(appendSerpSnapshot('p1', historySnapshot())).toBe(true);
    expect(loadSerpHistory('p1').snapshots).toHaveLength(1);
  });

  it('drops corrupt histories and snapshots while retaining good observations', () => {
    const valid = serializeSerpSnapshot(historySnapshot());
    write({ broken: {}, [key]: { snapshots: [valid, { ...valid, docs: [{ url: 'bad', rank: -1 }] }, null,
      { ...valid, id: 'wrong-context', query: 'other' }], lastAlertAt: 'invalid' } });
    expect(Object.keys(readSerpHistories('p1'))).toEqual([key]);
    expect(loadSerpHistory('p1')).toMatchObject({ snapshots: [{ id: valid.id }], lastAlertAt: null });
  });

  it.each([
    { centroid: [] }, { centroid: [null] }, { centroid: new Array(4097).fill(1) },
    { takenAt: 'yesterday' }, { k: 0 }, { query: '' }, { dominantIntent: 123 },
    { consensusEntities: [null] }, { docs: [{ url: 'https://example.test/', rank: 0 }] },
  ])('drops a corrupt observation: %j', (patch) => {
    write({ [key]: { snapshots: [{ ...serializeSerpSnapshot(historySnapshot()), ...patch }], lastAlertAt: null } });
    expect(loadSerpHistory('p1').snapshots).toEqual([]);
  });

  it('revalidates bounds, duplicates, and ordering on read', () => {
    const snapshots = Array.from({ length: 30 }, (_, index) => serializeSerpSnapshot(historySnapshot(29 - index)));
    write({ [key]: { snapshots: [...snapshots, snapshots[0]], lastAlertAt: null } });
    expect(loadSerpHistory('p1').snapshots.map((snapshot) => snapshot.id))
      .toEqual(Array.from({ length: 24 }, (_, index) => `snapshot-${index + 6}`));
  });

  it('does not need a browser window to save a valid observation', () => {
    vi.stubGlobal('window', undefined);
    try { expect(appendSerpSnapshot('p1', historySnapshot())).toBe(true); }
    finally { vi.unstubAllGlobals(); }
  });
});
