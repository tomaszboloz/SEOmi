import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeProjectId, readActiveTab, readBatchQueue, readBatchRun, readDataForSeoSerp,
  readDataForSeoSummary, readDataForSeoTarget, readHistory, writeBatchRun,
} from '@/stores/audit/auditStorage';
import { useProjectStore } from '@/stores/projectStore';
import * as keys from '@/stores/audit/auditConstants';
import * as storage from '@/services/storage';

vi.mock('@/services/storage', async (orig) => {
  const actual = await orig<typeof import('@/services/storage')>();
  return {
    ...actual,
    readStorage: vi.fn(actual.readStorage),
    writeStorage: vi.fn(actual.writeStorage),
    removeStorage: vi.fn(actual.removeStorage),
  };
});

const put = (key: string, value: unknown) =>
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
const summary = (patch: Record<string, unknown> = {}) => ({
  target: 'a.test', total_backlinks: 1, referring_domains: 2, referring_main_domains: 3,
  rank: 4, dofollow_backlinks: 5, broken_backlinks: 6, ...patch,
});
const serpItem = (patch: Record<string, unknown> = {}) => ({
  type: 'organic', rank_group: 1, rank_absolute: 1, domain: 'a.test', title: 't', description: 'd', url: 'u', ...patch,
});

describe('auditStorage readers', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({ activeProjectId: null });
    vi.mocked(storage.readStorage).mockClear();
  });

  it('prefers the stored active project, then the project store', () => {
    useProjectStore.setState({ activeProjectId: 'store-p' });
    expect(activeProjectId()).toBe('store-p');
    put(keys.ACTIVE_PROJECT_KEY, 'stored-p');
    expect(activeProjectId()).toBe('stored-p');
  });

  it('reads a valid active tab and falls back to overview for unknown ones', () => {
    put(keys.activeTabKey('p'), 'security');
    expect(readActiveTab('p')).toBe('security');
    put(keys.activeTabKey('p'), 'nonsense');
    expect(readActiveTab('p')).toBe('overview');
    expect(readActiveTab('empty')).toBe('overview');
  });

  it('falls back to safe defaults when storage reads throw', () => {
    vi.mocked(storage.readStorage).mockImplementation(() => { throw new Error('locked'); });
    expect(readActiveTab('p')).toBe('overview');
    expect(readHistory('p')).toEqual([]);
    expect(readBatchQueue('p')).toEqual([]);
    expect(readBatchRun('p')).toBeNull();
    expect(readDataForSeoSummary('p')).toBeNull();
    expect(readDataForSeoSerp('p')).toEqual([]);
    vi.mocked(storage.readStorage).mockImplementation((k) => localStorage.getItem(k));
  });

  it('returns empty values when nothing is stored for the project', () => {
    expect(readHistory('none')).toEqual([]);
    expect(readBatchQueue('none')).toEqual([]);
    expect(readBatchRun('none')).toBeNull();
    expect(readDataForSeoSerp('none')).toEqual([]);
  });

  it('reads history arrays only', () => {
    put(keys.historyKey('p'), [{ url: 'x' }]);
    expect(readHistory('p')).toEqual([{ url: 'x' }]);
    put(keys.historyKey('p'), { not: 'array' });
    expect(readHistory('p')).toEqual([]);
    put(keys.historyKey('p'), '{broken');
    expect(readHistory('p')).toEqual([]);
  });

  it('keeps only well-formed batch queue items and run records', () => {
    put(keys.batchQueueKey('p'), [{ id: 'a', url: 'u', status: 'queued' }, { id: 'b', url: 'u', status: 'bogus' }, null]);
    expect(readBatchQueue('p')).toEqual([{ id: 'a', url: 'u', status: 'queued' }]);
    put(keys.batchRunKey('p'), { id: 'r', startedAt: 's', updatedAt: 'u', status: 'running' });
    expect(readBatchRun('p')?.id).toBe('r');
    put(keys.batchRunKey('p'), { id: 'r', status: 'weird' });
    expect(readBatchRun('p')).toBeNull();
    put(keys.batchRunKey('p'), '{x');
    expect(readBatchRun('p')).toBeNull();
  });

  it('writes and removes the batch run, swallowing storage failures', () => {
    const run = { id: 'r', startedAt: 's', updatedAt: 'u', status: 'running' } as never;
    writeBatchRun('p', run);
    expect(JSON.parse(localStorage.getItem(keys.batchRunKey('p'))!).id).toBe('r');
    writeBatchRun('p', null);
    expect(localStorage.getItem(keys.batchRunKey('p'))).toBeNull();
    vi.mocked(storage.writeStorage).mockImplementationOnce(() => { throw new Error('quota'); });
    expect(() => writeBatchRun('p', run)).not.toThrow();
  });

  it('validates the DataForSEO summary shape', () => {
    put(keys.dataForSeoSummaryKey('p'), summary());
    expect(readDataForSeoSummary('p')?.target).toBe('a.test');
    put(keys.dataForSeoSummaryKey('p'), summary({ dofollow_backlinks: null }));
    expect(readDataForSeoSummary('p')?.dofollow_backlinks).toBeNull();
    for (const bad of [summary({ target: ' ' }), summary({ target: 3 }), summary({ rank: null }), summary({ rank: 'x' }), 'null', '5', '{x']) {
      put(keys.dataForSeoSummaryKey('p'), bad);
      expect(readDataForSeoSummary('p')).toBeNull();
    }
    localStorage.clear();
    expect(readDataForSeoSummary('p')).toBeNull();
  });

  it('filters malformed SERP items and caps the list at 100', () => {
    put(keys.dataForSeoSerpKey('p'), [serpItem(), serpItem({ rank_group: 'x' }), serpItem({ url: 1 }), null, 'str', serpItem({ title: null })]);
    expect(readDataForSeoSerp('p')).toHaveLength(1);
    put(keys.dataForSeoSerpKey('p'), Array.from({ length: 150 }, () => serpItem()));
    expect(readDataForSeoSerp('p')).toHaveLength(100);
    put(keys.dataForSeoSerpKey('p'), { a: 1 });
    expect(readDataForSeoSerp('p')).toEqual([]);
    put(keys.dataForSeoSerpKey('p'), '{x');
    expect(readDataForSeoSerp('p')).toEqual([]);
  });

  it('normalizes the DataForSEO target and returns null when blank', () => {
    put(keys.dataForSeoTargetKey('p'), '  Example.COM ');
    expect(readDataForSeoTarget('p')).toBe('example.com');
    put(keys.dataForSeoTargetKey('p'), '   ');
    expect(readDataForSeoTarget('p')).toBeNull();
    localStorage.clear();
    expect(readDataForSeoTarget('p')).toBeNull();
  });
});
