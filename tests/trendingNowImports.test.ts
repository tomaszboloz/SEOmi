import { describe, expect, it } from 'vitest';
import { importTrendingNow, MAX_TRENDING_ENTRIES, MAX_TRENDING_PAYLOAD_BYTES } from '@/services/trendingNow';
import { importedEntry } from './fixtures/trendingNow';

describe('Trending Now free imports', () => {
  it('accepts arrays and entries envelopes, preserving source labels without volume conversion', () => {
    for (const payload of [JSON.stringify([importedEntry]), JSON.stringify({ entries: [importedEntry] })]) {
      const snapshot = importTrendingNow('project-a', payload, 'json');
      expect(snapshot).toMatchObject({ projectId: 'project-a', geo: 'PL', source: { kind: 'json-import', url: null }, entries: [importedEntry] });
      expect(Number.isFinite(Date.parse(snapshot.capturedAt))).toBe(true);
      expect(snapshot.entries[0]).not.toHaveProperty('searchVolume');
    }
  });

  it('accepts a Google CSV export header, quoted commas, multiline text and escaped quotes', () => {
    const csv = '\uFEFFTrends,Search volume,Started,Ended,Trend breakdown,Explore link\r\n"Kot, pies",500+,,,"a\n""b""",https://example.com\r\n';
    const snapshot = importTrendingNow('a', csv, 'csv', ' us ');
    expect(snapshot).toMatchObject({ geo: 'US', source: { kind: 'csv-import', url: null }, entries: [{ keyword: 'Kot, pies', trafficLabel: '500+', startedAt: null }] });
    expect(importTrendingNow('a', 'keyword\n"""rower"""\n', 'csv').entries[0].keyword).toBe('"rower"');
  });

  it('handles CR/LF, empty trailing lines, canonical headers and absent metrics honestly', () => {
    expect(importTrendingNow('a', 'keyword,trafficLabel,startedAt\rrower,,2026-10-06\r\r', 'csv').entries)
      .toEqual([{ keyword: 'rower', trafficLabel: null, startedAt: '2026-10-06' }]);
    expect(importTrendingNow('a', 'keyword\nrower', 'csv').entries).toEqual([{ ...importedEntry, trafficLabel: null }]);
    expect(importTrendingNow('a', 'keyword\n', 'csv').entries).toEqual([]);
    expect(importTrendingNow('a', '[]', 'json').entries).toEqual([]);
  });

  it.each(['', 'other\nrower', 'keyword,trends\na,b', 'keyword,trafficLabel,traffic\na,b,c',
    'keyword,Started,startedAt\na,b,c', 'keyword,traffic\na', 'keyword\na,b', 'keyword\n"open',
    'keyword\n"closed"oops', 'keyword\noo"ps'])('rejects malformed CSV: %s', (csv) => {
    expect(() => importTrendingNow('a', csv, 'csv')).toThrow();
  });

  it.each(['broken', 'null', '{}', 'true', '12', '"hello"', '[null]', '[{}]', '[{"keyword":" "}]',
    '[{"keyword":12}]', '[{"keyword":"a","trafficLabel":2000}]', '[{"keyword":"a","startedAt":"nonsense"}]'])('rejects invalid JSON contracts: %s',
    (payload) => expect(() => importTrendingNow('a', payload, 'json')).toThrow());

  it('bounds entries, bytes and text fields without silently dropping rows', () => {
    const entries = Array.from({ length: MAX_TRENDING_ENTRIES }, () => importedEntry);
    expect(importTrendingNow('a', JSON.stringify(entries), 'json').entries).toHaveLength(MAX_TRENDING_ENTRIES);
    expect(() => importTrendingNow('a', JSON.stringify([...entries, importedEntry]), 'json')).toThrow(/count/);
    expect(() => importTrendingNow('a', 'keyword\n' + 'a\n'.repeat(MAX_TRENDING_ENTRIES + 1), 'csv')).toThrow(/limit/);
    expect(() => importTrendingNow('a', 'ą'.repeat(MAX_TRENDING_PAYLOAD_BYTES / 2 + 1), 'csv')).toThrow(/byte/);
    for (const extra of [{ keyword: 'x'.repeat(501) }, { trafficLabel: 'x'.repeat(129) }, { startedAt: 'x'.repeat(101) }]) {
      expect(() => importTrendingNow('a', JSON.stringify([{ ...importedEntry, ...extra }]), 'json')).toThrow();
    }
  });

  it.each(['', '../a', 'a_b', 'a'.repeat(81)])('rejects invalid project ID %s', (project) => {
    expect(() => importTrendingNow(project, '[]', 'json')).toThrow(/project/);
  });

  it('rejects an invalid geo or unsupported runtime format', () => {
    expect(() => importTrendingNow('a', '[]', 'json', 'POL')).toThrow(/country/);
    expect(() => importTrendingNow('a', '[]', 'xml' as 'json')).toThrow(/format/);
  });
});
