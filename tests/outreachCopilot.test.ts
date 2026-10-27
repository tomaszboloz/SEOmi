import { describe, expect, it } from 'vitest';
import type { BacklinkGapOpportunity } from '@/types';
import { draftOutreach, igosSourceStatus, normalizeDomain, outreachTargets, resolveIgosSource, targetsToCsv } from '@/services/outreachCopilot';

const row = (domain: string, own: number, links: Array<[string, number, number | null]>, spam: number | null = null): BacklinkGapOpportunity => ({
  referring_domain: domain,
  target_backlinks: own,
  competitor_backlinks: links.map(([d, backlinks, rank]) => ({ domain: d, backlinks, rank })),
  max_competitor_spam_score: spam,
});

describe('outreachTargets', () => {
  const data = [
    row('www.Blog.com', 0, [['a.com', 2, 80], ['b.com', 1, 60]]),
    row('blog.com', 0, [['c.com', 1, 70]]),
    row('news.org', 0, [['a.com', 1, 90]]),
    row('mine.net', 3, [['a.com', 1, 90]]),
    row('spam.biz', 0, [['a.com', 1, 90]], 95),
    row('dead.io', 0, [['a.com', 0, 50]]),
  ];
  it('dedupes domains, drops own and spam, ranks by relevance x authority', () => {
    const out = outreachTargets(data, 3);
    expect(out.map((t) => t.domain)).toEqual(['blog.com', 'news.org']);
    expect(out[0].linkingCompetitors).toEqual(['a.com', 'b.com', 'c.com']);
    expect(out[0].relevance).toBe(1);
    expect(out[0].priority).toBeCloseTo(0.7);
  });
  it('returns nothing for empty input and handles missing ranks', () => {
    expect(outreachTargets([], 3)).toEqual([]);
    expect(outreachTargets([row('x.com', 0, [['a.com', 1, null]])], 0)[0].priority).toBe(0);
  });
  it('limits relevance to the ordered TOP3 competitor set', () => {
    const result = outreachTargets([
      row('source.test', 0, [['one.test', 1, 100], ['two.test', 1, 100], ['three.test', 1, 100], ['four.test', 1, 100]]),
    ], 4, { topCompetitors: ['one.test', 'two.test', 'three.test', 'four.test'] });
    expect(result[0].linkingCompetitors).toEqual(['one.test', 'two.test', 'three.test']);
    expect(result[0].relevance).toBe(1);
  });
  it('treats non-finite ranks and an invalid rank scale as unknown authority', () => {
    expect(outreachTargets([row('nan.test', 0, [['one.test', 1, Number.NaN]])], 1)[0].authority).toBe(0);
    expect(outreachTargets([row('scale.test', 0, [['one.test', 1, 50]])], 1, { rankScale: 0 })[0].authority).toBe(0);
  });
  it('breaks equal priority ties by relevance and then domain', () => {
    const result = outreachTargets([row('z.test', 0, [['a.test', 1, 50]]), row('a.test', 0, [['a.test', 1, 50]])], 1);
    expect(result.map((item) => item.domain)).toEqual(['a.test', 'z.test']);
  });
  it('normalizes URLs to hosts', () => {
    expect(normalizeDomain('https://WWW.Site.com/path?q=1')).toBe('site.com');
  });
});

describe('draft and csv', () => {
  const target = outreachTargets([row('blog.com', 0, [['a.com', 1, 50]])], 1)[0];
  const template = { subject: 'Resource for {{domain}}', body: 'You link to {{competitors}}. See {{title}} {{url}}: {{summary}} -- {{site}}{{missing}}' };
  const evidence = {
    reportId: 'igos:https://me.com/study:3:2:1',
    sourceUrl: 'https://me.com/study',
    novelEntities: ['novel-metric', 'measured-dataset'],
    gainZones: 1,
    baselineDocs: 3,
    baselineProvenance: 'igos' as const,
  };
  const source = { title: 'Study', url: 'https://me.com/study', summary: 'Original data.', provenance: 'igos' as const, evidence };

  it('fills a draft only when a unique source with novelty evidence exists', () => {
    expect(draftOutreach(target, 'me.com', null, template)).toBeNull();
    expect(draftOutreach(target, '', source, template)).toBeNull();
    expect(draftOutreach(target, '   ', source, template)).toBeNull();
    expect(draftOutreach(target, 'me.com', { ...source, title: ' ' }, template)).toBeNull();
    expect(draftOutreach(target, 'me.com', { ...source, url: ' ' }, template)).toBeNull();
    expect(draftOutreach(target, 'me.com', { ...source, provenance: 'other' as any }, template)).toBeNull();
    expect(draftOutreach(target, 'me.com', { ...source, evidence: undefined as any }, template)).toBeNull();
    expect(draftOutreach(target, 'me.com', { ...source, evidence: { ...evidence, novelEntities: [] } }, template)).toBeNull();
    expect(draftOutreach(target, 'me.com', { ...source, evidence: { ...evidence, sourceUrl: 'https://other.com' } }, template)).toBeNull();
    expect(draftOutreach(target, 'me.com', source, template)).toEqual({
      to: 'blog.com',
      subject: 'Resource for blog.com',
      body: 'You link to a.com. See Study https://me.com/study: Original data. -- me.com',
    });
    expect(draftOutreach(target, 'me.com', { ...source, url: 'javascript:alert(1)' }, template)).toBeNull();
  });

  it('fails closed when IGOS or source novelty provenance is unavailable', () => {
    const ready = { status: 'ready' as const, igos: 72 };
    const partial = { status: 'partial' as const, igos: 41 };
    expect(igosSourceStatus(null)).toBe('unavailable');
    expect(igosSourceStatus({ status: 'off-topic', igos: null })).toBe('unavailable');
    expect(igosSourceStatus(partial)).toBe('partial');
    expect(resolveIgosSource(ready, { ...source, provenance: undefined })).toBeNull();
    expect(resolveIgosSource(ready, { ...source, evidence: undefined })).toBeNull();
    expect(resolveIgosSource(ready, { ...source, evidence: { ...evidence, novelEntities: [] } })).toBeNull();
    expect(resolveIgosSource(ready, { ...source, evidence: { ...evidence, baselineProvenance: 'other' as any } })).toBeNull();
    expect(resolveIgosSource(ready, { ...source, evidence: { ...evidence, sourceUrl: 'https://other.com' } })).toBeNull();
    expect(resolveIgosSource(ready, { ...source, url: 'https://user:pass@me.com/study' })).toBeNull();
    expect(resolveIgosSource(ready, { ...source, url: 'not-a-url' })).toBeNull();
    expect(resolveIgosSource(ready, null)).toBeNull();
    expect(resolveIgosSource(ready, source)).toEqual(source);
  });

  it('exports escaped, formula-safe CSV', () => {
    const csv = targetsToCsv([{ ...target, domain: '=cmd', linkingCompetitors: ['a,b', 'c"d'] }]);
    expect(csv.split('\n')[0]).toBe('domain,priority,relevance,authority,linking_competitors');
    expect(csv.split('\n')[1]).toBe(`'=cmd,0.500,1.00,0.50,"a,b | c""d"`);
  });
});
