import { describe, expect, it } from 'vitest';
import { busUrlKey, excludeQuarantined, isQuarantined, runRecommendationBus } from '@/services/recommendationBus';

describe('recommendation bus', () => {
  it('normalizes URLs and rejects non-http input', () => {
    expect(busUrlKey('https://a.test/x/#top')).toBe('https://a.test/x');
    expect(busUrlKey('https://a.test/')).toBe('https://a.test/');
    expect(busUrlKey('https://a.test//')).toBe('https://a.test/');
    expect(busUrlKey('ftp://a.test/x')).toBe('');
    expect(busUrlKey('not a url')).toBe('');
  });

  it('quarantines removals and redirects, removal wins, protected URLs stay', () => {
    const result = runRecommendationBus({
      removeUrls: ['https://a.test/off', 'https://a.test/off/', 'https://a.test/ranked', 'bad'],
      protectedUrls: ['https://a.test/ranked'],
      cannibal: [
        { canonical: 'https://a.test/a', urls: ['https://a.test/a', 'https://a.test/b', 'https://a.test/off', 'https://a.test/ranked', 'x'] },
        { canonical: 'https://a.test/off', urls: ['https://a.test/c'] },
        { canonical: 'nope', urls: ['https://a.test/z'] },
      ],
    });
    expect(result.quarantine.map((e) => [e.url, e.reason, e.target])).toEqual([
      ['https://a.test/off', 'remove', undefined],
      ['https://a.test/b', 'redirect', 'https://a.test/a'],
      ['https://a.test/c', 'redirect', 'https://a.test/off'],
    ]);
    expect(result.quarantine.every((e) => e.quarantined)).toBe(true);
    expect(result.conflicts).toEqual([
      { kind: 'protected-by-evidence', url: 'https://a.test/ranked' },
      { kind: 'canonical-removed', url: 'https://a.test/off' },
    ]);
  });

  it('works with no optional inputs', () => {
    expect(runRecommendationBus({ removeUrls: [] })).toEqual({ quarantine: [], conflicts: [] });
  });

  it('never leaves a removed or redirected URL as source or target of a link recommendation', () => {
    const { quarantine } = runRecommendationBus({ removeUrls: ['https://a.test/off'], cannibal: [{ canonical: 'https://a.test/a', urls: ['https://a.test/b'] }] });
    const items = [
      { sourceUrl: 'https://a.test/a', targetUrl: 'https://a.test/off/' },
      { sourceUrl: 'https://a.test/b', targetUrl: 'https://a.test/a' },
      { sourceUrl: 'https://a.test/a', targetUrl: 'https://a.test/c' },
    ];
    const { kept, dropped } = excludeQuarantined(items, quarantine);
    expect(kept).toEqual([items[2]]);
    expect(dropped).toHaveLength(2);
    expect(isQuarantined(quarantine, 'https://a.test/b#x')).toBe(true);
    expect(isQuarantined(quarantine, 'https://a.test/a')).toBe(false);
  });
});
