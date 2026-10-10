import { describe, expect, it } from 'vitest';
import {
  isFullScoreEligible, parseSerpCsv, parseSerpJson, sameSerpContext,
} from '@/services/serpImport';

describe('SERP import contracts', () => {
  it('requires keyword, rank and url CSV columns and keeps provenance', () => {
    const result = parseSerpCsv([
      'keyword,rank,url,provider,countryCode,locationCode,languageCode,capturedAt,availability',
      'SEO audit,1,https://www.Example.com/a,Provider,pl,2616,PL,2026-10-06T10:00:00Z,complete',
    ].join('\n'));
    expect(result.source).toMatchObject({ kind: 'csv-import', provider: 'Provider', countryCode: 'PL', locationCode: 2616, languageCode: 'pl', capturedAt: '2026-10-06T10:00:00Z', availability: 'complete' });
    expect(result.snapshots[0].urls).toEqual(['https://example.com/a']);
    expect(isFullScoreEligible(result.source)).toBe(true);
  });

  it('requires an explicit JSON records plus metadata envelope', () => {
    expect(() => parseSerpJson(JSON.stringify([{ keyword: 'a', rank: 1, url: 'https://a.test' }]))).toThrow(/records and metadata/);
    const result = parseSerpJson(JSON.stringify({ metadata: { provider: 'export', countryCode: 'PL', locationCode: 2616, languageCode: 'pl' }, records: [{ keyword: 'a', rank: 1, url: 'https://a.test' }] }));
    expect(result.source).toMatchObject({ kind: 'json-import', provider: 'export', capturedAt: null, availability: 'partial' });
    expect(isFullScoreEligible(result.source)).toBe(false);
  });

  it('keeps only TOP10, removes URL duplicates, and reports rejected rows', () => {
    const result = parseSerpCsv([
      'keyword,rank,url',
      'a,1,https://example.test/page?utm_source=x',
      'a,2,https://example.test/page',
      'a,11,https://outside.test',
      'a,nope,https://bad.test',
    ].join('\n'));
    expect(result.records).toEqual([{ keyword: 'a', rank: 1, url: 'https://example.test/page' }]);
    expect(result.duplicateCount).toBe(1);
    expect(result.excludedOutsideTop10).toBe(1);
    expect(result.rejected).toHaveLength(1);
  });

  it('downgrades an explicitly complete source when malformed records are rejected', () => {
    const result = parseSerpJson(JSON.stringify({ metadata: { availability: 'complete' }, records: [{ keyword: 'ok', rank: 1, url: 'https://ok.test' }, { keyword: '', rank: 1, url: 'https://bad.test' }] }));
    expect(result.source.availability).toBe('partial');
    expect(result.source.reason).toBe('invalid-records');
    expect(result.snapshots).toHaveLength(1);
  });

  it('rejects unsafe URLs, invalid status reasons and oversized payloads', () => {
    expect(() => parseSerpCsv('keyword,rank,url\na,1,javascript:alert(1)')).not.toThrow();
    expect(parseSerpCsv('keyword,rank,url\na,1,javascript:alert(1)').rejected).toHaveLength(1);
    expect(() => parseSerpJson(JSON.stringify({ metadata: { availability: 'blocked' }, records: [] }))).toThrow(/needs a reason/);
    expect(() => parseSerpCsv('keyword,rank,url\n"a"oops,1,https://a.test')).toThrow(/quoting/);
    expect(() => parseSerpCsv(`keyword,rank,url\na,1,https://a.test\n${'x'.repeat(1_048_576)}`)).toThrow(/byte limit/);
  });

  it('requires matching market and language before a pair can use full SERP score', () => {
    const a = parseSerpJson(JSON.stringify({ metadata: { countryCode: 'PL', locationCode: 2616, languageCode: 'pl', availability: 'complete' }, records: [] })).source;
    const b = { ...a, kind: 'csv-import' as const };
    const c = { ...a, languageCode: 'en' };
    expect(sameSerpContext(a, b)).toBe(true);
    expect(sameSerpContext(a, c)).toBe(false);
  });
});
