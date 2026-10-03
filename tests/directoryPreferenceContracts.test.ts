import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyPreferences, PAGE_SIZE, preferenceKey, readPreferences } from '@/components/Charts/crawlDirectory/preferences';
import * as storageContracts from '@/services/storageContracts';

afterEach(() => vi.restoreAllMocks());

describe('directory preference persistence contracts', () => {
  it('uses project/run identities and independent empty preferences', () => {
    expect(preferenceKey('one', 'run')).toBe('seomi_project_one_crawl_directory_run_v1');
    expect(preferenceKey('two', 'run')).not.toBe(preferenceKey('one', 'run'));
    expect(preferenceKey('one', 'next')).not.toBe(preferenceKey('one', 'run'));
    expect(preferenceKey(null, 'run')).toBeNull();
    expect(PAGE_SIZE).toBe(100);
    const first = emptyPreferences();
    first.expanded.folder = true;
    first.visibleCounts.folder = 200;
    expect(emptyPreferences()).toEqual({ query: '', expanded: {}, visibleCounts: {}, selectedUrl: null });
    expect(readPreferences(null)).toEqual(emptyPreferences());
  });

  it('defaults malformed/missing storage and recovers from parser exceptions', () => {
    expect(readPreferences('missing')).toEqual(emptyPreferences());
    for (const value of ['{bad', 'null', '[]', JSON.stringify({ query: 12, selectedUrl: false, expanded: 'bad', visibleCounts: null })]) {
      localStorage.setItem('prefs', value);
      expect(readPreferences('prefs')).toEqual(emptyPreferences());
    }
    vi.spyOn(storageContracts, 'readJsonRecord').mockImplementationOnce(() => { throw new Error('parse failed'); });
    expect(readPreferences('prefs')).toEqual(emptyPreferences());
  });

  it('validates booleans, safe page counts, key lengths and bounded user strings', () => {
    localStorage.setItem('prefs', JSON.stringify({
      query: 'q'.repeat(201), selectedUrl: 'u'.repeat(2049),
      expanded: { valid: true, closed: false, invalid: 'true', ['x'.repeat(2049)]: true },
      visibleCounts: { valid: 100, large: 2_000_000, short: 99, fractional: 100.5, string: '200', unsafe: Number.MAX_SAFE_INTEGER + 1, ['x'.repeat(2061)]: 100 },
    }));
    const result = readPreferences('prefs');
    expect(result.query).toHaveLength(200);
    expect(result.selectedUrl).toHaveLength(2048);
    expect(result.expanded).toEqual({ valid: true, closed: false });
    expect(result.visibleCounts).toEqual({ valid: 100, large: 1_000_000 });
  });

  it('retains the newest five hundred stored entries without mutating the saved record', () => {
    const expanded = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`folder${i}`, i % 2 === 0]));
    const visibleCounts = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`folder${i}:pages`, 100 + i]));
    const saved = JSON.stringify({ expanded, visibleCounts });
    localStorage.setItem('prefs', saved);
    const result = readPreferences('prefs');
    expect(Object.keys(result.expanded)).toHaveLength(500);
    expect(Object.keys(result.visibleCounts)).toHaveLength(500);
    expect(result.expanded.folder0).toBeUndefined();
    expect(result.expanded.folder500).toBe(true);
    expect(result.visibleCounts['folder500:pages']).toBe(600);
    expect(localStorage.getItem('prefs')).toBe(saved);
  });
});
