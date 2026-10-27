import { describe, expect, it, vi } from 'vitest';
import type { BacklinkGapOpportunity, CrawledPageSummary } from '@/types';
import { draftOutreach, informationGainSource, normalizeDomain, produceInformationGain, outreachTargets, targetsToCsv } from '@/services/outreachCopilot';
import type { IgosReport } from '@/services/igos/report';

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
    expect(outreachTargets(data, 2, { competitorDomains: ['a.com', 'b.com'] })[0].linkingCompetitors).toEqual(['a.com', 'b.com']);
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

describe('evidence-bound IGOS sources', () => {
  const report = (status: IgosReport['status'] = 'ready'): IgosReport => ({
    status, igos: status === 'unavailable' ? null : 74, components: null, coverage: null, multiplier: null,
    onTopicShare: null, availableDocs: 3, requestedDocs: 3, novelEntities: ['local study'],
    zones: [{ chunk: { text: 'gain', offset: 0, heading: null, vector: new Float64Array([1]) }, topic: 0.8, nearest: 0.4, zone: 'gain', evidence: { url: 'https://competitor.example/source', rank: 1, passageIndex: 0 } }], limitations: [],
  });
  const input = { projectId: 'project-a', site: 'https://site.example', report: report(), source: { title: 'Study', url: 'https://site.example/study', summary: 'Observed data.' } };

  it('returns only a verified source from a ready report', () => {
    expect(informationGainSource(input)).toMatchObject({ score: 74, evidenceUrl: 'https://competitor.example/source', novelEntities: ['local study'], provenance: { provider: 'unavailable', observedAt: null } });
    expect(informationGainSource({ ...input, report: report('partial') })).toBeNull();
    expect(informationGainSource({ ...input, source: null })).toBeNull();
  });

  it('rejects source metadata that cannot be opened as a web URL', () => {
    expect(informationGainSource({ ...input, source: { ...input.source, url: 'not-a-url' } })).toBeNull();
    expect(informationGainSource({ ...input, report: { ...report(), zones: [] } })).toBeNull();
  });
});

describe('production IGOS caller', () => {
  const page = { url: 'https://site.example/article', final_url: 'https://site.example/article', title: 'Own study', word_count: 200, semantic_terms: ['own evidence'], semantic_excerpts: ['Own evidence about the topic.'], rag_sections: [] } as unknown as CrawledPageSummary;
  const fetched = vi.fn(async (source: { sourceUrl: string }) => ({ sourceUrl: source.sourceUrl, authority: null, fetchedAt: '2026-01-01T00:00:00Z', availability: 'ok' as const, text: 'competitor topic content', vector: null }));
  const embed = vi.fn(async (texts: string[]) => texts.map((_, index) => index === 0 ? new Float64Array([0.8, 0.6]) : new Float64Array([1, 0])));

  it('builds project evidence from crawl pages and live competitor IO', async () => {
    const result = await produceInformationGain({ projectId: 'p1', site: 'https://site.example', competitors: ['a.example', 'b.example', 'c.example'], pages: [page] }, new AbortController().signal, { fetch: fetched, embed });
    expect(fetched).toHaveBeenCalledTimes(3);
    expect(embed).toHaveBeenCalledWith(expect.arrayContaining(['Own evidence about the topic.']));
    expect(result).toMatchObject({ projectId: 'p1', source: { title: 'Own study', url: 'https://site.example/article' } });
    expect(result?.provenance).toMatchObject({ provider: 'local-hash', model: 'hash-1024-n345', approximation: 'local-lexical' });
  });

  it('fails closed when one live competitor source is unavailable', async () => {
    const unavailable = vi.fn(async (source: { sourceUrl: string }) => ({ ...await fetched(source), availability: 'unavailable' as const, text: '' }));
    await expect(produceInformationGain({ projectId: 'p1', site: 'https://site.example', competitors: ['a.example', 'b.example', 'c.example'], pages: [page] }, new AbortController().signal, { fetch: unavailable, embed })).resolves.toBeNull();
  });

  it('fails closed before IO for missing project, target, or malformed competitors', async () => {
    const input = { projectId: 'p1', site: 'https://site.example', competitors: ['a.example', 'b.example', 'c.example'], pages: [page] };
    expect(await produceInformationGain({ ...input, projectId: '' }, new AbortController().signal, { fetch: fetched, embed })).toBeNull();
    expect(await produceInformationGain({ ...input, site: '' }, new AbortController().signal, { fetch: fetched, embed })).toBeNull();
    expect(await produceInformationGain({ ...input, pages: [] }, new AbortController().signal, { fetch: fetched, embed })).toBeNull();
    expect(await produceInformationGain({ ...input, competitors: ['a', 'b', 'c'] }, new AbortController().signal, { fetch: fetched, embed })).toBeNull();
  });

  it('uses retained RAG paragraphs when semantic excerpts and terms are absent', async () => {
    const sparse = { ...page, title: 'RAG source', semantic_terms: [], semantic_excerpts: [], rag_sections: [{ heading: 'Evidence', level: 2, paragraphs: ['Retained paragraph evidence.'], tables: 0 }] } as unknown as CrawledPageSummary;
    const result = await produceInformationGain({ projectId: 'p1', site: 'https://site.example', competitors: ['a.example', 'b.example', 'c.example'], pages: [sparse] }, new AbortController().signal, { fetch: fetched, embed });
    expect(result?.source?.title).toBe('RAG source');
  });
});
