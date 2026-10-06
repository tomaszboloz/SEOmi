import { describe, expect, it, vi } from 'vitest';
import { clearTrendingNow, importTrendingNow, readTrendingNow, saveTrendingNow, trendingNowStorageKey,
  MAX_TRENDING_PAYLOAD_BYTES, type TrendingSnapshot } from '@/services/trendingNow';
import { importedEntry } from './fixtures/trendingNow';

const snapshot = () => importTrendingNow('a', JSON.stringify([importedEntry]), 'json');

describe('project-scoped Trending Now storage', () => {
  it('stores independently per project and clears only the requested scope', () => {
    const a = snapshot();
    const b = importTrendingNow('b', '[{"keyword":"kot"}]', 'json');
    expect(trendingNowStorageKey('a')).toBe('seomi_project_a_trending_now_v1');
    expect(readTrendingNow('a')).toBeNull();
    expect(saveTrendingNow('a', a)).toBe(true);
    expect(saveTrendingNow('b', b)).toBe(true);
    expect(readTrendingNow('a')).toEqual(a);
    expect(readTrendingNow('b')).toEqual(b);
    expect(clearTrendingNow('a')).toBe(true);
    expect(readTrendingNow('a')).toBeNull();
    expect(readTrendingNow('b')).toEqual(b);
  });

  it('rejects projectless operations and cross-project writes before touching storage', () => {
    const a = snapshot();
    expect(() => saveTrendingNow('b', a)).toThrow(/scope/);
    expect(() => saveTrendingNow('', a)).toThrow(/project/);
    expect(() => readTrendingNow('../a')).toThrow(/project/);
    expect(() => clearTrendingNow('')).toThrow(/project/);
    expect(localStorage.length).toBe(0);
  });

  it('validates stored source, capture, entries and country instead of trusting JSON', () => {
    const valid = snapshot();
    for (const value of [null, 12, {}, { ...valid, projectId: 'b' }, { ...valid, geo: null },
      { ...valid, capturedAt: null }, { ...valid, capturedAt: 'bad' }, { ...valid, source: null },
      { ...valid, source: { kind: 'mock', url: null } }, { ...valid, entries: [{}] },
      { ...valid, source: { kind: 'json-import', url: 'https://evil.test' } },
      { ...valid, source: { kind: 'google-trends-rss', url: null } },
      { ...valid, source: { kind: 'google-trends-rss', url: 'http://trends.google.com/trending/rss?geo=PL' } }]) {
      localStorage.setItem(trendingNowStorageKey('a'), JSON.stringify(value));
      expect(readTrendingNow('a')).toBeNull();
    }
    localStorage.setItem(trendingNowStorageKey('a'), '{broken');
    expect(readTrendingNow('a')).toBeNull();
    localStorage.setItem(trendingNowStorageKey('a'), 'x'.repeat(MAX_TRENDING_PAYLOAD_BYTES + 1));
    expect(readTrendingNow('a')).toBeNull();
  });

  it('roundtrips a Google source and strips unsupported metrics or object properties', () => {
    const rss: TrendingSnapshot = { ...snapshot(), source: { kind: 'google-trends-rss', url: 'https://trends.google.com/trending/rss?geo=PL' } };
    expect(saveTrendingNow('a', { ...rss, entries: [{ ...importedEntry, searchVolume: 20000 } as typeof importedEntry] })).toBe(true);
    expect(readTrendingNow('a')).toEqual(rss);
    expect(localStorage.getItem(trendingNowStorageKey('a'))).not.toContain('searchVolume');
  });

  it('reports unavailable storage and quota failures without claiming a durable save', () => {
    const a = snapshot();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(saveTrendingNow('a', a)).toBe(false);
    write.mockRestore();
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readTrendingNow('a')).toBeNull();
    read.mockRestore();
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(clearTrendingNow('a')).toBe(false);
    remove.mockRestore();
  });
});
