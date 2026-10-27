import { describe, expect, it } from 'vitest';
import { parseSerpCsv, parseSerpImport, parseSerpJson } from '@/services/serpImport';
import { assertSerpPayload, buildSerpImport, normalizeRecord, normalizeSource } from '@/services/serpImport/normalize';

const row = (keyword = 'a', rank = 1, url = 'https://example.test'): Record<string, unknown> => ({ keyword, rank, url });

describe('SERP import edge contracts', () => {
  it('normalizes source metadata and result URLs', () => {
    const source = normalizeSource('json-import', { provider: ' ', sourceUrl: 'https://Source.EXAMPLE/a?b=2', countryCode: 'pl', locationCode: '2616', languageCode: 'PL-pl', capturedAt: '2026-10-06T10:00:00Z', retrievedAt: null, availability: 'blocked', reason: 'manual' });
    expect(source).toMatchObject({ provider: null, sourceUrl: 'https://source.example/a?b=2', countryCode: 'PL', locationCode: 2616, languageCode: 'pl-pl', availability: 'blocked', reason: 'manual' });
    expect(normalizeSource('csv-import', undefined).availability).toBe('partial');
    expect(normalizeRecord({ keyword: '  foo   bar  ', rank: 1, url: 'HTTPS://WWW.Example.com:443//a///?z=2&gclid=x#h' })).toEqual({ keyword: 'foo bar', rank: 1, url: 'https://example.com/a?z=2' });
    expect(normalizeRecord({ keyword: 'http', rank: '2', url: 'http://WWW.Example.com:80/x?x=1' })).toEqual({ keyword: 'http', rank: 2, url: 'http://example.com/x?x=1' });
  });

  it('rejects malformed source and record values', () => {
    expect(() => assertSerpPayload('ok')).not.toThrow();
    expect(() => normalizeSource('json-import', null)).toThrow(/metadata/);
    expect(() => normalizeSource('json-import', [])).toThrow(/metadata/);
    expect(() => normalizeSource('json-import', { provider: 1 })).toThrow(/source text/);
    expect(() => normalizeSource('json-import', { provider: 'x'.repeat(201) })).toThrow(/source text/);
    expect(() => normalizeSource('json-import', { sourceUrl: 'ftp://example.test' })).toThrow(/source URL/);
    expect(() => normalizeSource('json-import', { sourceUrl: 'https://u:p@example.test' })).toThrow(/source URL/);
    expect(() => normalizeSource('json-import', { countryCode: 'POL' })).toThrow(/country/);
    expect(() => normalizeSource('json-import', { languageCode: 'p' })).toThrow(/language/);
    expect(() => normalizeSource('json-import', { locationCode: 0 })).toThrow(/location/);
    expect(() => normalizeSource('json-import', { availability: 'unknown' })).toThrow(/availability/);
    expect(() => normalizeSource('json-import', { availability: 'missing' })).toThrow(/needs a reason/);
    expect(() => normalizeSource('json-import', { capturedAt: 'yesterday-ish' })).toThrow(/timestamp/);
    expect(() => normalizeRecord(null)).toThrow(/record/);
    expect(() => normalizeRecord([])).toThrow(/record/);
    expect(() => normalizeRecord(row(''))).toThrow(/keyword/);
    expect(() => normalizeRecord(row('a', 0))).toThrow(/rank/);
    expect(() => normalizeRecord(row('a', 101))).toThrow(/rank/);
    expect(() => normalizeRecord({ keyword: 'a', rank: 1, url: '' })).toThrow(/URL/);
    expect(() => normalizeRecord({ keyword: 'a', rank: 1, url: 'javascript:alert(1)' })).toThrow(/result URL/);
    expect(() => normalizeRecord({ keyword: 'a', rank: 1, url: 'https://u:p@example.test' })).toThrow(/result URL/);
    expect(() => normalizeSource('json-import', { availability: 'missing', reason: 'offline' })).not.toThrow();
  });

  it('builds snapshots, replaces better duplicates and enforces limits', () => {
    const result = buildSerpImport('json-import', [row('Key', 5, 'https://same.test'), row('key', 1, 'https://same.test'), row('Key', 2, 'https://second.test')], undefined);
    expect(result.records).toEqual([{ keyword: 'key', rank: 1, url: 'https://same.test/' }, { keyword: 'key', rank: 2, url: 'https://second.test/' }]);
    expect(result.duplicateCount).toBe(1);
    const conflict = buildSerpImport('json-import', [row('x', 1, 'https://one.test'), row('x', 1, 'https://two.test')], { availability: 'complete' });
    expect(conflict.records).toEqual([]);
    expect(conflict.rejected).toHaveLength(2);
    expect(conflict.rejected[0].reason).toMatch(/multiple URLs/);
    expect(conflict.source.availability).toBe('partial');
    const complete = buildSerpImport('json-import', [row('ok'), null], { availability: 'complete', reason: 'upstream' });
    expect(complete.source).toMatchObject({ availability: 'partial', reason: 'upstream' });
    expect(() => buildSerpImport('json-import', 'bad' as unknown as unknown[], {})).toThrow(/record limit/);
    expect(() => buildSerpImport('json-import', Array.from({ length: 2001 }, () => row()), {})).toThrow(/record limit/);
    expect(() => buildSerpImport('json-import', [row()], { availability: 'blocked', reason: 'blocked' })).toThrow(/cannot contain/);
    expect(() => buildSerpImport('json-import', [row()], { availability: 'missing', reason: 'missing' })).toThrow(/cannot contain/);
    const keywords = Array.from({ length: 201 }, (_, index) => row(`keyword-${index}`, 1, `https://example.test/${index}`));
    expect(() => buildSerpImport('json-import', keywords, {})).toThrow(/keyword limit/);
  });

  it('parses quoted CRLF CSV and reports metadata conflicts', () => {
    const csv = '\uFEFFquery,position,link,source-provider,source-uri,market,location,lang,captured,retrieved,status,status-reason\r\n"foo, ""bar""",1,https://example.test/a,Provider,https://source.test/export,pl,2616,pl,2026-10-06T10:00:00Z,2026-10-06T10:01:00Z,complete,\r\nplain,2,https://example.test/b,,,,,,,,\r\n\r\n';
    const result = parseSerpCsv(csv);
    expect(result.source).toMatchObject({ provider: 'Provider', sourceUrl: 'https://source.test/export', availability: 'complete' });
    expect(result.records).toHaveLength(2);
    const conflict = parseSerpCsv('keyword,rank,url,provider\na,1,https://a.test,A\nb,2,https://b.test,B');
    expect(conflict.rejected[0]).toMatchObject({ row: 3, reason: expect.stringMatching(/Conflicting/) });
    expect(() => parseSerpCsv('keyword,query,rank,url\na,1,https://a.test')).toThrow(/Ambiguous/);
    expect(() => parseSerpCsv('keyword,rank\na,1')).toThrow(/url column/);
    expect(() => parseSerpCsv('')).toThrow(/header/);
    expect(() => parseSerpCsv('keyword,rank,url\n"a,1,https://a.test')).toThrow(/Unclosed/);
    expect(() => parseSerpCsv('keyword,rank,url\n"a"oops,1,https://a.test')).toThrow(/quoting/);
  });

  it('uses both stable format adapters and rejects malformed JSON', () => {
    expect(parseSerpImport('keyword,rank,url\na,1,https://a.test', 'csv').records).toHaveLength(1);
    expect(parseSerpImport(JSON.stringify({ metadata: {}, records: [row()] }), 'json').records).toHaveLength(1);
    expect(() => parseSerpJson('{')).toThrow(/Invalid SERP JSON/);
    expect(() => parseSerpJson(JSON.stringify({ metadata: [], records: [] }))).toThrow(/records and metadata/);
    expect(() => parseSerpJson(JSON.stringify({ metadata: {}, records: 'bad' }))).toThrow(/records and metadata/);
  });
});
