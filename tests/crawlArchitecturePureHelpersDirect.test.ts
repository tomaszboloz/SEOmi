import { describe, expect, it } from 'vitest';
import {
  shortUrl,
  emptyPreferences,
  readPreferences,
  discoveryLabel,
  returnToMapStart,
} from '@/components/Charts/crawlArchitecture/CrawlArchitectureHelpers';
import { buildMapViewTabs } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';

describe('crawl architecture pure helpers direct assertions', () => {
  it('shortUrl extracts pathname and query or returns raw fallback', () => {
    expect(shortUrl('https://example.com/blog/post?tag=seo')).toBe('/blog/post?tag=seo');
    expect(shortUrl('https://example.com/')).toBe('/');
    expect(shortUrl('invalid-url')).toBe('invalid-url');
  });

  it('emptyPreferences returns default semantic map preferences', () => {
    const prefs = emptyPreferences();
    expect(prefs.query).toBe('');
    expect(prefs.clusterFilter).toBe('all');
    expect(prefs.orphansOnly).toBe(false);
    expect(prefs.activeView).toBe('graph');
    expect(prefs.transform).toEqual({ x: 0, y: 0, k: 1 });
  });

  it('readPreferences parses valid JSON and handles null or corrupted data', () => {
    expect(readPreferences(null)).toEqual(emptyPreferences());
    expect(readPreferences('non-existent-key')).toEqual(emptyPreferences());

    const validKey = 'test_map_prefs';
    localStorage.setItem(
      validKey,
      JSON.stringify({
        query: 'test-query',
        activeView: 'directory',
        transform: { x: 10, y: 20, k: 1.5 },
      }),
    );

    const loaded = readPreferences(validKey);
    expect(loaded.query).toBe('test-query');
    expect(loaded.activeView).toBe('directory');
    expect(loaded.transform).toEqual({ x: 10, y: 20, k: 1.5 });
  });

  it('discoveryLabel translates known discovery sources and falls back to key', () => {
    const translate = (key: string) => `translated:${key}`;
    expect(discoveryLabel('start', translate)).toBe('translated:mapUi.discovery.start');
    expect(discoveryLabel('sitemap', translate)).toBe('translated:mapUi.discovery.sitemap');
    expect(discoveryLabel('custom', translate)).toBe('custom');
  });

  it('buildMapViewTabs returns configured tab items with icons', () => {
    const translate = (key: string) => `label:${key}`;
    const tabs = buildMapViewTabs(translate);
    expect(tabs).toHaveLength(3);
    expect(tabs.map((t) => t.id)).toEqual(['graph', 'directory', 'plan']);
    expect(tabs[0].label).toBe('label:mapUi.tabs.graph');
  });

  it('returnToMapStart scrolls map section into view without error', () => {
    expect(() => returnToMapStart()).not.toThrow();
  });
});
