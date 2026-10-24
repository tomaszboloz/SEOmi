import { describe, expect, it } from 'vitest';
import type { BacklinkGapOpportunity } from '@/types';
import { draftOutreach, normalizeDomain, outreachTargets, targetsToCsv } from '@/services/outreachCopilot';

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
  it('normalizes URLs to hosts', () => {
    expect(normalizeDomain('https://WWW.Site.com/path?q=1')).toBe('site.com');
  });
});

describe('draft and csv', () => {
  const target = outreachTargets([row('blog.com', 0, [['a.com', 1, 50]])], 1)[0];
  const template = { subject: 'Resource for {{domain}}', body: 'You link to {{competitors}}. See {{title}} {{url}}: {{summary}} -- {{site}}{{missing}}' };
  const source = { title: 'Study', url: 'https://me.com/study', summary: 'Original data.' };
  it('fills a draft only when a unique source exists', () => {
    expect(draftOutreach(target, 'me.com', null, template)).toBeNull();
    expect(draftOutreach(target, '', source, template)).toBeNull();
    expect(draftOutreach(target, 'me.com', { ...source, title: ' ' }, template)).toBeNull();
    expect(draftOutreach(target, 'me.com', source, template)).toEqual({
      to: 'blog.com',
      subject: 'Resource for blog.com',
      body: 'You link to a.com. See Study https://me.com/study: Original data. -- me.com',
    });
  });
  it('exports escaped, formula-safe CSV', () => {
    const csv = targetsToCsv([{ ...target, domain: '=cmd', linkingCompetitors: ['a,b', 'c"d'] }]);
    expect(csv.split('\n')[0]).toBe('domain,priority,relevance,authority,linking_competitors');
    expect(csv.split('\n')[1]).toBe(`'=cmd,0.500,1.00,0.50,"a,b | c""d"`);
  });
});
