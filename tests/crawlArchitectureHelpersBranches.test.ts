import { beforeEach, describe, expect, it } from 'vitest';
import {
  discoveryLabel, emptyPreferences, readPreferences, shortUrl,
} from '@/components/Charts/crawlArchitecture/CrawlArchitectureHelpers';
import i18n from '@/i18n';

const KEY = 'seomi_arch_prefs_test';
const store = (value: unknown) => localStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));

describe('readPreferences', () => {
  beforeEach(() => localStorage.clear());

  it('returns defaults for a missing key, no storage entry, bad JSON and non-objects', () => {
    expect(readPreferences(null)).toEqual(emptyPreferences());
    expect(readPreferences(KEY)).toEqual(emptyPreferences());
    store('{not json');
    expect(readPreferences(KEY)).toEqual(emptyPreferences());
    store('[1,2]');
    expect(readPreferences(KEY)).toEqual(emptyPreferences());
  });

  it('restores valid preferences', () => {
    store({
      query: 'seo', clusterFilter: 'c1', orphansOnly: true, linkMode: 'all',
      selectedUrl: 'https://a.test/', activeView: 'plan',
      positions: { 'https://a.test/': { x: 1, y: 2 } }, transform: { x: 5, y: 6, k: 2 },
    });
    expect(readPreferences(KEY)).toEqual({
      query: 'seo', clusterFilter: 'c1', orphansOnly: true, linkMode: 'all',
      selectedUrl: 'https://a.test/', activeView: 'plan',
      positions: { 'https://a.test/': { x: 1, y: 2 } }, transform: { x: 5, y: 6, k: 2 },
    });
    store({ activeView: 'directory' });
    expect(readPreferences(KEY).activeView).toBe('directory');
  });

  it('sanitizes wrongly typed and out-of-range values', () => {
    store({
      query: 'q'.repeat(300), clusterFilter: 5, orphansOnly: 'yes', linkMode: 'weird',
      selectedUrl: 7, activeView: 'bogus', positions: { good: { x: 1, y: 1 }, bad: { x: 'a', y: 1 } },
      transform: { x: 0, y: 0, k: 99 },
    });
    const prefs = readPreferences(KEY);
    expect(prefs.query).toHaveLength(200);
    expect(prefs.clusterFilter).toBe('all');
    expect(prefs.orphansOnly).toBe(false);
    expect(prefs.linkMode).toBe('content');
    expect(prefs.selectedUrl).toBeNull();
    expect(prefs.activeView).toBe('graph');
    expect(Object.keys(prefs.positions)).toEqual(['good']);
    expect(prefs.transform).toEqual({ x: 0, y: 0, k: 1 });
  });

  it('keeps at most 160 positions and ignores a non-string query', () => {
    const positions = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`u${i}`, { x: i, y: i }]));
    store({ query: 4, positions });
    const prefs = readPreferences(KEY);
    expect(Object.keys(prefs.positions)).toHaveLength(160);
    expect(prefs.query).toBe('');
  });
});

describe('shortUrl and discoveryLabel', () => {
  it('shortens absolute URLs to path plus query and keeps invalid input', () => {
    expect(shortUrl('https://a.test/x/y?z=1')).toBe('/x/y?z=1');
    expect(shortUrl('https://a.test')).toBe('/');
    expect(shortUrl('not a url')).toBe('not a url');
    expect(shortUrl('foo:')).toBe('/');
  });

  it('translates known discovery kinds and passes unknown ones through', async () => {
    await i18n.changeLanguage('en');
    const t = (key: string) => i18n.t(key);
    expect(discoveryLabel('start', t)).toBe(i18n.t('mapUi.discovery.start'));
    expect(discoveryLabel('seed', t)).toBe(i18n.t('mapUi.discovery.seed'));
    expect(discoveryLabel('sitemap', t)).toBe(i18n.t('mapUi.discovery.sitemap'));
    expect(discoveryLabel('link', t)).toBe(i18n.t('mapUi.discovery.link'));
    expect(discoveryLabel('custom', t)).toBe('custom');
  });
});
