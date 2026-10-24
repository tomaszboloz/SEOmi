import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearOffPageHistory, deleteOffPageHistory, loadOffPageHistory, offPageHistoryKey, saveOffPageHistory } from '@/services/offPage/history';
import { offPageHistorySchema } from '@/services/offPage/historySchema';
import { historyRecord } from './fixtures/offPageHistory';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('persists only compact validated evidence and isolates projects', () => {
  const record = { ...historyRecord(), text: 'secret', vector: [1], sources: [{ ...historyRecord().sources[0], text: 'secret', vector: [1] }] };
  expect(saveOffPageHistory('p', record)).toBe(true);
  expect(loadOffPageHistory('p')).toEqual([historyRecord()]);
  expect(loadOffPageHistory('q')).toEqual([]);
  expect(localStorage.getItem(offPageHistoryKey('p'))).not.toContain('secret');
  expect(offPageHistoryKey('p')).toBe('seomi_project_p_offpage_history_v1');
});

it('retains ten newest unique records even with out-of-order dates and replaces matching ids', () => {
  for (let index = 0; index < 12; index += 1) {
    saveOffPageHistory('p', historyRecord({ id: `r${index}`, createdAt: new Date(Date.UTC(2026, 9, index + 1)).toISOString() }));
  }
  expect(loadOffPageHistory('p').map((record) => record.id)).toEqual(['r11', 'r10', 'r9', 'r8', 'r7', 'r6', 'r5', 'r4', 'r3', 'r2']);
  saveOffPageHistory('p', historyRecord({ id: 'r11', topicLabel: 'Updated' }));
  expect(loadOffPageHistory('p')[0].topicLabel).toBe('Updated');
  saveOffPageHistory('p', historyRecord({ id: 'old', createdAt: '2020-01-01T00:00:00.000Z' }));
  expect(loadOffPageHistory('p')).toHaveLength(10);
  expect(loadOffPageHistory('p').some((record) => record.id === 'old')).toBe(false);
});

it.each(['not json', 'null', '{}', '42'])('drops corrupt history %s', (raw) => {
  localStorage.setItem(offPageHistoryKey('p'), raw);
  expect(loadOffPageHistory('p')).toEqual([]);
  expect(localStorage.getItem(offPageHistoryKey('p'))).toBeNull();
});

it('drops corrupt entries and duplicate ids but repairs valid stripped records', () => {
  localStorage.setItem(offPageHistoryKey('p'), JSON.stringify([null, historyRecord(), historyRecord(), { ...historyRecord(), id: '' }]));
  expect(loadOffPageHistory('p')).toEqual([historyRecord()]);
  expect(JSON.parse(localStorage.getItem(offPageHistoryKey('p'))!)).toEqual([historyRecord()]);
  expect(loadOffPageHistory('p')).toEqual([historyRecord()]);
});

it.each([
  { id: '' }, { createdAt: 'yesterday' }, { scale: 0 }, { embeddingProvider: '' }, { embeddingModelId: '' },
  { sourcesRequested: -1 }, { sourcesFetched: 2 }, { sourcesScored: 2 }, { sourcesRequested: 26 },
  { sources: [{ ...historyRecord().sources[0], availability: 'fake' }] },
  { sources: [{ ...historyRecord().sources[0], authority: Infinity }] },
  { sources: [{ ...historyRecord().sources[0], similarity: 2 }] },
  { sources: [{ ...historyRecord().sources[0], contribution: null }] },
  { tbva: { value: null, status: 'ready', limitations: [] } },
  { tbva: { value: 1, status: 'unavailable', limitations: [] } },
  { coCitations: [{ ...historyRecord().coCitations[0], offset: -1 }] },
  { coCitations: [{ ...historyRecord().coCitations[0], excerpt: 'x'.repeat(301) }] },
  { coCitations: [{ ...historyRecord().coCitations[0], sourceUrl: 'https://other.test' }] },
])('rejects invalid record $id $scale $createdAt', (overrides) => {
  expect(offPageHistorySchema.safeParse({ ...historyRecord(), ...overrides }).success).toBe(false);
});

it('deletes one record or clears only the requested project', () => {
  saveOffPageHistory('p', historyRecord());
  saveOffPageHistory('p', historyRecord({ id: 'keep' }));
  saveOffPageHistory('q', historyRecord());
  expect(deleteOffPageHistory('p', 'record')).toBe(true);
  expect(loadOffPageHistory('p').map((record) => record.id)).toEqual(['keep']);
  expect(clearOffPageHistory('p')).toBe(true);
  expect(loadOffPageHistory('p')).toEqual([]);
  expect(loadOffPageHistory('q')).toHaveLength(1);
});

it('handles missing projects, invalid writes and unavailable storage without throwing', () => {
  expect(loadOffPageHistory(null)).toEqual([]);
  expect(saveOffPageHistory(null, historyRecord())).toBe(false);
  expect(deleteOffPageHistory(null, 'record')).toBe(false);
  expect(clearOffPageHistory(null)).toBe(false);
  expect(saveOffPageHistory('p', historyRecord({ id: '' }))).toBe(false);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(saveOffPageHistory('p', historyRecord())).toBe(false);
  expect(deleteOffPageHistory('p', 'record')).toBe(false);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('locked'); });
  expect(loadOffPageHistory('p')).toEqual([]);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('locked'); });
  expect(clearOffPageHistory('p')).toBe(false);
});
