import { describe, expect, it } from 'vitest';
import {
  assertTrendingProject,
  trendingGeo,
  trendingEntries,
  trendingSnapshot,
} from '@/services/trendingNow/contracts';
import {
  trendingCsvRows,
  trendingCsvEntries,
} from '@/services/trendingNow/csv';

describe('trendingNow contracts and csv direct assertions', () => {
  it('assertTrendingProject validates alphanumeric project IDs up to 80 chars', () => {
    expect(() => assertTrendingProject('project-123')).not.toThrow();
    expect(() => assertTrendingProject('invalid/id')).toThrow(/valid project/);
    expect(() => assertTrendingProject('')).toThrow(/valid project/);
    expect(() => assertTrendingProject('a'.repeat(81))).toThrow(/valid project/);
  });

  it('trendingGeo validates and upper-cases two-letter country codes', () => {
    expect(trendingGeo('pl')).toBe('PL');
    expect(trendingGeo(' US ')).toBe('US');
    expect(() => trendingGeo('USA')).toThrow(/two-letter country/);
    expect(() => trendingGeo('')).toThrow(/two-letter country/);
    expect(() => trendingGeo(null as never)).toThrow(/two-letter country/);
  });

  it('trendingEntries validates array of trending items with dates', () => {
    const raw = [
      { keyword: 'AI tools', trafficLabel: '10K+', startedAt: '2026-10-01T00:00:00Z' },
      { keyword: 'SEO guide' },
    ];
    const parsed = trendingEntries(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].keyword).toBe('AI tools');
    expect(parsed[1].trafficLabel).toBeNull();

    expect(() => trendingEntries(null)).toThrow();
    expect(() => trendingEntries([{ keyword: '' }])).toThrow();
  });

  it('trendingSnapshot builds a complete typed snapshot', () => {
    const snapshot = trendingSnapshot(
      'proj-1',
      'PL',
      { kind: 'csv-import', url: null },
      [{ keyword: 'keyword 1' }],
      '2026-10-06T12:00:00.000Z',
    );
    expect(snapshot.projectId).toBe('proj-1');
    expect(snapshot.geo).toBe('PL');
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.capturedAt).toBe('2026-10-06T12:00:00.000Z');
    expect(() => trendingSnapshot('proj-1', 'PL', { kind: 'json-import', url: 'https://unexpected.test' } as never, [])).toThrow(/import source/);
  });

  it('trendingCsvRows parses comma-separated rows with quotes', () => {
    const csv = 'keyword,traffic,started\r\n"AI ""Agents""",10K,2026-10-01\r\nSEO,5K,';
    const rows = trendingCsvRows(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toBe('AI "Agents"');
    expect(rows[2][0]).toBe('SEO');
  });

  it('trendingCsvEntries extracts keyword, traffic and startedAt columns', () => {
    const csv = 'Keyword,Traffic,Started\nReact,50K,2026-09-01\nVue,20K,';
    const entries = trendingCsvEntries(csv);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      keyword: 'React',
      trafficLabel: '50K',
      startedAt: '2026-09-01',
    });
  });
});
