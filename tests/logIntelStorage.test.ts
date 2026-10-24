import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLogState, logStorageKey, readLogState, saveLogState } from '@/services/logIntelligence/storage';
import { emptyImportState } from '@/services/logIntelligence';
import { coveredLogState } from './fixtures/logIntel';

afterEach(() => vi.restoreAllMocks());
describe('project-scoped log storage', () => {
  it('roundtrips aggregates and resume state, isolates project keys and clears only that project', () => {
    const state = coveredLogState();
    state.inProgress = { hash: 'partial', offset: 50 };
    expect(saveLogState('one', state)).toBe(true);
    expect(saveLogState('two', emptyImportState())).toBe(true);
    expect(readLogState('one')).toEqual(state);
    expect(readLogState('two')).toEqual(emptyImportState());
    expect(readLogState('missing')).toEqual(emptyImportState());
    expect(clearLogState('one')).toBe(true);
    expect(localStorage.getItem(logStorageKey('one'))).toBeNull();
    expect(localStorage.getItem(logStorageKey('two'))).not.toBeNull();
    expect(logStorageKey('a/b')).not.toBe(logStorageKey('a%2Fb'));
  });
  it.each([
    '{', 'null', '[]', '{}', JSON.stringify({ ...emptyImportState(), lines: -1 }),
    JSON.stringify({ ...emptyImportState(), lines: '1' }),
    JSON.stringify({ ...emptyImportState(), inProgress: { hash: 'h', offset: -1 } }),
    JSON.stringify({ ...emptyImportState(), days: ['2026-02-31'] }),
    JSON.stringify({ ...emptyImportState(), days: ['2026-xx-01'] }),
    JSON.stringify({ ...emptyImportState(), days: ['2026-10-01', '2026-10-01'] }),
    JSON.stringify({ ...emptyImportState(), malformed: 1 }),
    JSON.stringify({ ...emptyImportState(), firstAt: 2, lastAt: 1 }),
    JSON.stringify({ ...emptyImportState(), firstAt: 1 }),
    JSON.stringify({ ...emptyImportState(), aggs: { bad: {} } }),
  ])('drops corrupt persisted input %s', (raw) => {
    localStorage.setItem(logStorageKey('p1'), raw);
    expect(readLogState('p1')).toEqual(emptyImportState());
    expect(localStorage.getItem(logStorageKey('p1'))).toBeNull();
  });
  it('validates aggregate counts, statuses, timestamps and dates', () => {
    for (const change of [{ hits: -1 }, { hits: 31 }, { firstAt: Date.UTC(2030, 0, 1) }, { status: 'fake' }, { lastAt: 9e15 }]) {
      const state = coveredLogState();
      Object.assign(Object.values(state.aggs)[0], change);
      localStorage.setItem(logStorageKey('p1'), JSON.stringify(state));
      expect(readLogState('p1')).toEqual(emptyImportState());
    }
  });
  it('drops unknown fields rather than retaining accidental raw-IP evidence', () => {
    const state = { ...emptyImportState(), rawIp: '1.2.3.4' };
    localStorage.setItem(logStorageKey('p1'), JSON.stringify(state));
    expect(readLogState('p1')).toEqual(emptyImportState());
  });
  it('handles denied reads, quota failures and denied deletion without crashing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(readLogState('p1')).toEqual(emptyImportState());
    expect(saveLogState('p1', emptyImportState())).toBe(false);
    expect(clearLogState('p1')).toBe(false);
  });
});
