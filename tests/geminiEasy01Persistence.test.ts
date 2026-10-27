import { describe, expect, it } from 'vitest';
import { readGscSnapshots, saveGscSnapshot } from '@/services/gscTracker/persistence';
import { MAX_GSC_SNAPSHOTS_PER_PROJECT } from '@/services/gscTracker/limits';
import type { GscPerformanceData } from '@/types';
import i18n from '@/i18n';

const createMemoryStorage = (): Pick<Storage, 'getItem' | 'setItem'> => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
  };
};

const sampleData = (startDate: string, endDate: string, extra: Partial<GscPerformanceData> = {}): GscPerformanceData => ({
  site_url: 'sc-domain:example.com',
  start_date: startDate,
  end_date: endDate,
  total_clicks: 100,
  total_impressions: 2000,
  avg_ctr: 5.0,
  avg_position: 10.0,
  queries: [{ query: 'keyword', clicks: 100, impressions: 2000, ctr: 5.0, position: 10.0 }],
  pages: [{ page: 'https://example.com/', clicks: 100, impressions: 2000, ctr: 5.0, position: 10.0 }],
  daily: [{ date: startDate, clicks: 100, impressions: 2000, ctr: 5.0, position: 10.0 }],
  queries_may_be_truncated: false,
  pages_may_be_truncated: false,
  daily_may_be_truncated: false,
  max_rows_per_dimension: 25000,
  ...extra,
});

describe('GSC snapshot persistence and project-local read isolation', () => {
  it('maintains strict project-local storage isolation across distinct project IDs', () => {
    const storage = createMemoryStorage();
    saveGscSnapshot('project-alpha', sampleData('2026-07-01', '2026-07-28'), storage);
    saveGscSnapshot('project-beta', sampleData('2026-08-01', '2026-08-28'), storage);

    const alphaSnapshots = readGscSnapshots('project-alpha', storage);
    const betaSnapshots = readGscSnapshots('project-beta', storage);
    const emptySnapshots = readGscSnapshots('project-gamma', storage);

    expect(alphaSnapshots).toHaveLength(1);
    expect(alphaSnapshots[0].start_date).toBe('2026-07-01');
    expect(betaSnapshots).toHaveLength(1);
    expect(betaSnapshots[0].start_date).toBe('2026-08-01');
    expect(emptySnapshots).toEqual([]);
  });

  it('deduplicates and upserts snapshots when site_url, date window, and normalized filters match', () => {
    const storage = createMemoryStorage();
    saveGscSnapshot('project-alpha', sampleData('2026-08-01', '2026-08-28', {
      total_clicks: 50,
      filters: { country: ' POL ', device: 'DESKTOP' },
    }), storage);

    const { snapshots } = saveGscSnapshot('project-alpha', sampleData('2026-08-01', '2026-08-28', {
      total_clicks: 120,
      filters: { country: 'pol', device: 'DESKTOP' },
    }), storage);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].total_clicks).toBe(120);
    expect(snapshots[0].filters).toEqual({ country: 'pol', device: 'DESKTOP' });
    expect(readGscSnapshots('project-alpha', storage)).toHaveLength(1);
  });

  it('retains multiple snapshots when date window or filters differ', () => {
    const storage = createMemoryStorage();
    saveGscSnapshot('project-alpha', sampleData('2026-07-01', '2026-07-28'), storage);
    saveGscSnapshot('project-alpha', sampleData('2026-08-01', '2026-08-28'), storage);
    saveGscSnapshot('project-alpha', sampleData('2026-08-01', '2026-08-28', {
      filters: { device: 'MOBILE' },
    }), storage);

    const loaded = readGscSnapshots('project-alpha', storage);
    expect(loaded).toHaveLength(3);
  });

  it('rejects empty, blank, or whitespace-only project identifiers', () => {
    const storage = createMemoryStorage();
    const data = sampleData('2026-08-01', '2026-08-28');
    const expectedError = i18n.t('runtimeErrors.schedules.projectRequired');
    expect(() => saveGscSnapshot('', data, storage)).toThrow(expectedError);
    expect(() => saveGscSnapshot('   ', data, storage)).toThrow(expectedError);
  });

  it('safely handles throwing storage adapters and non-array storage payloads without crashing', () => {
    const brokenStorage: Pick<Storage, 'getItem'> = {
      getItem: () => { throw new Error('storage blocked'); },
    };
    expect(readGscSnapshots('project-locked', brokenStorage)).toEqual([]);

    for (const malformed of ['{"site_url":"single"}', '42', 'true', '"a string"']) {
      const mockStorage: Pick<Storage, 'getItem'> = { getItem: () => malformed };
      expect(readGscSnapshots('project-malformed', mockStorage)).toEqual([]);
    }
  });

  it('bounds snapshots strictly to MAX_GSC_SNAPSHOTS_PER_PROJECT', () => {
    const storage = createMemoryStorage();
    for (let i = 1; i <= 9; i++) {
      const day = String(i).padStart(2, '0');
      saveGscSnapshot('project-capped', sampleData(`2026-0${i}-01`, `2026-0${i}-${day}`), storage);
    }
    const snapshots = readGscSnapshots('project-capped', storage);
    expect(snapshots).toHaveLength(MAX_GSC_SNAPSHOTS_PER_PROJECT);
    expect(snapshots[0].start_date).toBe('2026-09-01');
    expect(snapshots.some((s) => s.start_date === '2026-01-01')).toBe(false);
  });
});
