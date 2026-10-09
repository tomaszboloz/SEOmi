import { describe, expect, it } from 'vitest';
import { normalizeGraphUrl, pageOwnersByUrl } from '@/services/semanticGraph/urls';
import { buildContentEdges } from '@/services/semanticGraph/content';
import { buildSemanticTopics } from '@/services/semanticGraph/topics';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, terms?: string[]) => ({ url, semantic_terms: terms }) as CrawledPageSummary;

describe('semantic graph evidence responsibilities', () => {
  it('preserves query identity while resolving relative URLs and stripping fragments', () => {
    expect(normalizeGraphUrl(' ../article///?id=2#section ', 'https://SITE.test/guides/start')).toBe('https://site.test/article?id=2');
    expect(normalizeGraphUrl(undefined, 'https://site.test/start')).toBe('');
    expect(normalizeGraphUrl(null)).toBe('');
    expect(normalizeGraphUrl('invalid///#anchor')).toBe('invalid');
    expect(normalizeGraphUrl('https://site.test/')).toBe('https://site.test/');
  });

  it('retains unique redirect aliases, rejects duplicate requests and ignores blank identities', () => {
    const owners = pageOwnersByUrl([
      { ...page('https://site.test/old'), final_url: 'https://site.test/new' },
      page('https://site.test/duplicate'), page('https://site.test/duplicate/'), page(''),
    ]);
    expect([...owners]).toEqual([
      ['https://site.test/old', 'page-0'], ['https://site.test/new', 'page-0'],
    ]);
    expect(pageOwnersByUrl([]).size).toBe(0);
  });

  it('counts repeated measured links while keeping at most three unique text anchors', () => {
    const targets = [' One ', 'One', 'Two', 'Three', 'Four', undefined];
    const source = {
      ...page('https://site.test/source'),
      semantic_links: [
        ...targets.map((anchor_text) => ({ target_url: '/target', anchor_text, is_internal: true })),
        { target_url: '/target', anchor_text: 'External', is_internal: false },
        { target_url: '/source', anchor_text: 'Self', is_internal: true },
        { target_url: '/uncrawled', anchor_text: 'Unknown', is_internal: true },
      ],
    } as CrawledPageSummary;
    const graph = buildContentEdges([source, page('https://site.test/target')], {});
    expect(graph.allEdges).toEqual([{
      id: 'page-0->page-1', source: 'page-0', target: 'page-1', anchors: ['One', 'Two', 'Three'], links: 6,
    }]);
    expect(graph.incoming.get('page-1')).toBe(6);
    expect(buildContentEdges([source], { includeAllInternalLinks: true }).edges).toEqual([]);
  });

  it('normalizes and bounds actual terms without using titles or URL paths', () => {
    const terms = ['żółć', 'zolc', '', ...Array.from({ length: 50 }, (_, index) => `term${index}`)];
    const graph = buildSemanticTopics([page('https://site.test/coffee', terms), page('https://site.test/coffee2')]);
    expect(graph.termsByPage[0]).toHaveLength(40);
    expect(graph.termsByPage[0].slice(0, 3)).toEqual(['und:zolc', 'und:term0', 'und:term1']);
    expect(graph.termsByPage[1]).toEqual([]);
    expect(graph.groupMembers.size).toBe(2);
    expect(graph.topicEdges).toEqual([]);
    expect(graph.find(0)).toBe(0);
  });

  it('joins transitively related pages and reports exact lexical Jaccard evidence', () => {
    const graph = buildSemanticTopics([
      page('https://site.test/a', ['coffee', 'espresso', 'grinding']),
      page('https://site.test/b', ['coffee', 'espresso']),
      page('https://site.test/c', ['coffee', 'espresso', 'beans']),
    ]);
    const common = Math.log(2);
    const rare = Math.log(4);
    expect(graph.groupMembers.size).toBe(1);
    expect(graph.find(2)).toBe(graph.find(0));
    expect(graph.groupDetails.get(graph.find(0))).toEqual({ id: 'cluster-0', label: 'coffee / espresso' });
    expect(graph.topicEdges[0].weightedJaccard).toBeCloseTo(2 * common / (2 * common + rare));
    expect(graph.totalTopicEdges).toBe(3);
    expect(graph.topicEdges[0].sharedTerms).toEqual(['coffee', 'espresso']);
  });

  it('rejects overlap below the Jaccard floor even with two shared terms', () => {
    const graph = buildSemanticTopics([
      page('https://site.test/a', ['common1', 'common2', ...Array.from({ length: 38 }, (_, index) => `left${index}`)]),
      page('https://site.test/b', ['common1', 'common2', ...Array.from({ length: 38 }, (_, index) => `right${index}`)]),
    ]);
    expect(graph.totalTopicEdges).toBe(0);
    expect(graph.groupMembers.size).toBe(2);
  });
});
