import { describe, expect, it } from 'vitest';
import { dedupeSerpRows, evidenceFromLive, marketMismatch, serpUrlKey, summarizeSerpEvidence } from '@/services/serpSnapshot';

const market = { countryCode: 'PL', languageCode: 'pl', requestedDepth: 10, retrievedAt: '2026-10-30T00:00:00Z' };

describe('SERP normalization (#86 GEM-86-06, T03, T04)', () => {
  it('builds one key for scheme, www, tracking, fragment and trailing-slash variants', () => {
    const key = serpUrlKey('https://a.pl/x');
    expect(serpUrlKey('http://www.A.pl/x/')).toBe(key);
    expect(serpUrlKey('https://a.pl/x?utm_source=n&gclid=1#top')).toBe(key);
    expect(serpUrlKey('https://a.pl/x?b=2&a=1')).toBe(serpUrlKey('https://a.pl/x?a=1&b=2'));
    expect(serpUrlKey('https://a.pl:8443/x')).toBe('a.pl:8443/x');
    expect(serpUrlKey('https://a.pl/')).toBe('a.pl');
    expect(serpUrlKey('ftp://a.pl/x')).toBeNull();
    expect(serpUrlKey('not a url')).toBeNull();
  });

  it('keeps the best rank, re-numbers and counts duplicates and invalid rows', () => {
    const result = dedupeSerpRows([
      { url: 'https://b.pl/', rank: 3 }, { url: 'http://www.a.pl/x/', rank: 4 }, { url: 'https://a.pl/x', rank: 1 },
      { url: 'bad', rank: 2 }, { url: 'https://c.pl', rank: 0 }, { url: 'https://d.pl', rank: 1.5 },
    ]);
    expect(result).toEqual({ rows: [{ url: 'https://a.pl/x', rank: 1 }, { url: 'https://b.pl/', rank: 2 }], duplicates: 1, invalid: 3 });
    expect(dedupeSerpRows([])).toEqual({ rows: [], duplicates: 0, invalid: 0 });
  });

  it('counts the real K after canonical de-duplication, so variants never fill a TOP 10', () => {
    const urls = [...Array.from({ length: 9 }, (_, i) => `https://s${i}.pl/`), 'http://www.s0.pl'];
    const evidence = evidenceFromLive('seo', urls, market);
    expect(evidence).toMatchObject({ actualK: 9, availability: 'partial', reason: 'fewer-than-top10' });
    expect(summarizeSerpEvidence([evidence])?.fullScoreEligible).toBe(false);
  });

  it('reports market mismatch and unknown metadata instead of assuming a match', () => {
    expect(marketMismatch({ countryCode: 'pl', languageCode: 'pl-PL' }, { countryCode: 'PL', languageCode: 'pl' })).toEqual([]);
    expect(marketMismatch({ countryCode: 'DE', languageCode: 'de' }, { countryCode: 'PL', languageCode: 'pl' })).toEqual(['country', 'language']);
    expect(marketMismatch({ countryCode: null, languageCode: null }, { countryCode: 'PL', languageCode: 'pl' })).toEqual(['unknown-country', 'unknown-language']);
  });
});
