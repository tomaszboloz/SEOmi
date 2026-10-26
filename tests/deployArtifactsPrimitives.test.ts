import { describe, expect, it } from 'vitest';
import { csvRows } from '@/services/deployArtifacts/csv';
import { ruleKey, rulePath } from '@/services/deployArtifacts/rules';

describe('deploy artifact primitives', () => {
  it('ruleKey keeps http(s) hrefs without fragment and rejects other schemes', () => {
    expect(ruleKey('https://Example.com/a#frag')).toBe('https://example.com/a');
    expect(ruleKey('http://example.com')).toBe('http://example.com/');
    expect(ruleKey('https://example.com/a?x=1')).toBe('https://example.com/a?x=1');
    for (const bad of ['javascript:alert(1)', 'ftp://example.com/a', '/relative', '', 'not a url']) expect(ruleKey(bad), bad).toBe('');
  });

  it('rulePath decodes the pathname and refuses query-bearing sources', () => {
    expect(rulePath('https://example.com/a%20b/c')).toBe('/a b/c');
    expect(rulePath('https://example.com/')).toBe('/');
    expect(rulePath('https://example.com/a?x=1')).toBeNull();
    expect(rulePath('https://example.com/%E0%A4%A')).toBe('/%E0%A4%A');
  });

  it('csvRows quotes fields, neutralizes formulas, keeps URLs and ends with CRLF', () => {
    expect(csvRows([['url', 'n', 'ok'], ['https://x.test/a', 3, true]])).toBe('url,n,ok\r\nhttps://x.test/a,3,true\r\n');
    expect(csvRows([['=SUM(A1)', '+1', '@cmd', '-2']])).toBe("'=SUM(A1),'+1,'@cmd,'-2\r\n");
    expect(csvRows([['a,b', 'say "hi"', 'line\nbreak']])).toBe('"a,b","say ""hi""","line\nbreak"\r\n');
    expect(csvRows([])).toBe('\r\n');
  });
});
