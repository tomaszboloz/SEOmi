import { describe, expect, it } from 'vitest';
import { clusterKeywordsBySerpOverlap, normalizeSerpUrl, getSerpSnapshot } from '../src/services/keywordClustering';

describe('keyword SERP clustering', () => {
  it('normalizes host, trailing slash and tracking parameters without changing meaningful paths', () => {
    expect(normalizeSerpUrl('https://www.example.com/seo/?utm_source=test&b=2&a=1#section'))
      .toBe('example.com/seo?a=1&b=2');
    expect(normalizeSerpUrl('https://one.example/page')).toBe('one.example/page');
    expect(normalizeSerpUrl('https://example.com/SEO/')).toBe('example.com/SEO');
    expect(normalizeSerpUrl('javascript:alert(1)')).toBeNull();
  });

  it('forms clusters only when the configured number of actual URLs overlap', () => {
    const result = clusterKeywordsBySerpOverlap([
      { keyword: 'audyt seo', urls: ['https://a.example/', 'https://b.example/', 'https://c.example/'] },
      { keyword: 'audyt strony', urls: ['https://www.a.example', 'https://b.example/', 'https://c.example/?utm_campaign=x'] },
      { keyword: 'pozycjonowanie', urls: ['https://b.example/', 'https://c.example/'] },
      { keyword: 'lokalne seo', urls: ['https://elsewhere.example/'] },
    ], 3, '2026-09-22T10:00:00.000Z');

    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].keywords).toEqual(['audyt seo', 'audyt strony']);
    expect(result.clusters[0].pairOverlaps[0].sharedUrls).toEqual([
      'a.example/', 'b.example/', 'c.example/',
    ]);
    expect(result.unclusteredKeywords).toEqual(['pozycjonowanie', 'lokalne seo']);
    expect(result.analyzedAt).toBe('2026-09-22T10:00:00.000Z');
  });

  it('allows transitive clusters but preserves only evidence-backed pair links', () => {
    const result = clusterKeywordsBySerpOverlap([
      { keyword: 'a', urls: ['https://one.example/', 'https://two.example/'] },
      { keyword: 'b', urls: ['https://one.example/', 'https://two.example/', 'https://three.example/'] },
      { keyword: 'c', urls: ['https://two.example/', 'https://three.example/'] },
    ], 2);

    expect(result.clusters[0].keywords).toEqual(['a', 'b', 'c']);
    expect(result.clusters[0].pairOverlaps).toHaveLength(2);
    expect(result.clusters[0].pairOverlaps.map((pair) => [pair.keywordA, pair.keywordB])).toEqual([['a', 'b'], ['b', 'c']]);
  });

  it('removes duplicate keywords case-insensitively and rejects invalid overlap thresholds', () => {
    const result = clusterKeywordsBySerpOverlap([
      { keyword: 'SEO', urls: ['https://one.example/'] },
      { keyword: 'seo', urls: ['https://other.example/'] },
    ], 1);
    expect(result.snapshots).toHaveLength(1);
    expect(() => clusterKeywordsBySerpOverlap([], 0)).toThrow('positive integer');
  });
  it('requires distinct normalized shared URLs before linking keywords', () => {
    const result = clusterKeywordsBySerpOverlap([
      {keyword:'first',urls:['https://example.com/a']},
      {keyword:'second',urls:['https://example.com/a','http://www.example.com/a/','https://example.com/a?utm_source=test']},
    ],3,'2026-10-01T00:00:00Z');
    expect(result.clusters).toEqual([]);
    expect(result.unclusteredKeywords).toEqual(['first','second']);
  });

  it('builds a snapshot from valid absolute provider URLs without merging query identities', () => {
    const row = (url:string) => ({type:'organic',url,rank_group:1,rank_absolute:1,domain:'example.com',title:'Observed title',description:'Observed description'});
    const rows = [' https://example.com/a?q=1 ', 'https://example.com/a?q=1','https://example.com/a?q=2','javascript:alert(1)','https://user:secret@example.com/a','not a URL'].map(row);
    expect(getSerpSnapshot('visible keyword',rows)).toEqual({keyword:'visible keyword',urls:['https://example.com/a?q=1','https://example.com/a?q=2']});
    expect(rows[0].url).toBe(' https://example.com/a?q=1 ');
    expect(getSerpSnapshot('empty',[])).toEqual({keyword:'empty',urls:[]});
  });

  it('keeps different nondefault service ports as distinct SERP pages', () => {
    expect(normalizeSerpUrl('https://example.com:8443/a')).toBe('example.com:8443/a');
    const result = clusterKeywordsBySerpOverlap([
      {keyword:'first',urls:['https://example.com:8443/a']},
      {keyword:'second',urls:['https://example.com:9443/a']},
    ],1);
    expect(result.clusters).toEqual([]);
    expect(normalizeSerpUrl('https://example.com:443/a')).toBe('example.com/a');
  });


  it.each([NaN,Infinity,-1,0,1.5])('rejects unsupported overlap threshold %s before building a result', threshold => {
    expect(()=>clusterKeywordsBySerpOverlap([],threshold)).toThrow('positive integer');
  });

  it('retains one shared URL as one link when threshold is one, independent of URL variants', () => {
    const snapshots=[{keyword:'first',urls:['https://example.com/a']},{keyword:'second',urls:['https://www.example.com/a/','http://example.com/a?utm_source=test','https://example.com/a#fragment']}];
    const result=clusterKeywordsBySerpOverlap(snapshots,1,'2026-10-01T00:00:00Z');
    expect(result.clusters[0].pairOverlaps).toEqual([{keywordA:'first',keywordB:'second',sharedUrls:['example.com/a']}]);
    expect(snapshots[1].urls).toHaveLength(3);
    expect(result.snapshots[1].urls).toEqual(['example.com/a']);
  });

});
