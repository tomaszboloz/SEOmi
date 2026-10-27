import { describe, expect, it } from 'vitest';
import { buildClusters } from '@/services/hreflangParity/cluster';
import { compareParity, summarize } from '@/services/hreflangParity/parity';
import { buildBaseline } from '@/services/igos/baseline';
import { normalize } from '@/services/embeddings/vector';
import { classifyIndexability, detectConflicts } from '@/services/indexabilityGate';
import { computeSprs, simulateWhatIf } from '@/services/semanticGraph/sprs';
import { mergeGscPageRows } from '@/services/semanticGraph/trafficMerge';
import { classifyPage, linkGraph } from '@/services/siteFocus/pageType';
import { buildTopTenContentGap } from '@/services/targetPhraseAudit/contentGap';
import { clusterTemplates, patternOf } from '@/services/templateGovernor/cluster';
import { governTemplates, templateInformationGain } from '@/services/templateGovernor/informationGain';
import type { CompetitorDoc } from '@/services/igos/types';

const h = (url: string) => ({ url, hreflangs: [{ language: 'EN', target_url: url }, { language: 'en', target_url: url }] });
const doc = (id: string, entities: string[]): CompetitorDoc => ({ url: id, rank: 1, fetchedAt: null, status: 200, entities, passages: [{ text: 'body', vector: normalize([1, 0]) }], terms: new Map() });
const gatePage = (patch: Record<string, unknown> = {}) => ({ url: 'https://site.test/p', final_url: 'https://site.test/p', http_status: 200, ...patch }) as never;

describe('coverage100 semantic edge branches', () => {
  it('sorts separate hreflang clusters and reuses language buckets', () => {
    const first = buildClusters([h('https://b.test/x'), h('https://a.test/x')]);
    const second = buildClusters([h('https://a.test/x'), h('https://b.test/x')]);
    expect(first.map((row) => row.urls[0])).toEqual(['https://a.test/x', 'https://b.test/x']);
    expect(second).toHaveLength(2);
    expect(first[0].languages.get('en')).toEqual(['https://a.test/x']);
  });

  it('compares parity with local exceptions and every depth status', () => {
    const report = compareParity({ referenceLanguage: 'en', complete: true, shallowRatio: 0.5, localExceptions: new Map([['pl', new Set(['local'])]]), coverage: new Map([
      ['en', new Map([['covered', 100], ['shallow', 100], ['missing', 100], ['local', 100]])],
      ['pl', new Map([['covered', 100], ['shallow', 20], ['missing', 0], ['local', 0]])],
    ]) });
    expect(summarize(report)).toEqual({ covered: 1, shallow: 1, missing: 1, 'intentionally-local': 1 });
  });

  it('separates consensus and rare entity frequencies', () => {
    const docs = [doc('a', ['A', 'Rare', 'Mid']), doc('b', ['a', 'mid']), doc('c', ['A']), doc('d', ['A']), doc('e', ['A']), doc('f', ['A'])];
    const baseline = buildBaseline(docs, 5);
    expect(baseline.consensusEntities).toContain('A');
    expect(baseline.rareEntities).toContain('Rare');
  });

  it('follows verdict, robots and unknown indexability evidence', () => {
    expect(classifyIndexability(gatePage({ indexability_verdict: { status: 'blocked' } }))).toBe('noindex');
    expect(classifyIndexability(gatePage({ indexability_verdict: { status: 'indexable' } }))).toBe('indexable');
    expect(classifyIndexability(gatePage({ indexability_verdict: { status: 'pending' } }))).toBe('unknown');
    expect(classifyIndexability(gatePage({ robots_decision: { indexability: 'index' } }))).toBe('indexable');
    expect(classifyIndexability(gatePage({ x_robots_tag: 'noindex' }))).toBe('noindex');
    expect(detectConflicts({ pages: [gatePage({ url: 'not-a-url' })] })).toEqual([]);
  });

  it('handles missing traffic metrics, link graph targets and what-if ties', () => {
    expect(mergeGscPageRows({} as never, {} as never)).toEqual({ clicks: 0, impressions: 0, ctr: 0, position: 0 });
    expect(mergeGscPageRows({ impressions: 10, position: 1 } as never, { position: 2 } as never).position).toBe(1);
    const pages = [{ url: 'https://site.test/a', final_url: 'https://site.test/a', depth: 1, links: [{ target_url: '/missing', is_internal: true }, { target_url: '/a', is_internal: true }], word_count: 100, title: 'a' }, { url: 'https://site.test/b', final_url: 'https://site.test/b', depth: 2, links: [], word_count: 100, title: 'b' }] as never;
    expect(linkGraph(pages).targets.get('https://site.test/a')).toBe(0);
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(simulateWhatIf(nodes, [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }], { add: [{ source: 'c', target: 'a' }] })).toBeTruthy();
    expect(computeSprs(nodes, []).status).toBe('ready');
  });

  it('classifies missing-link pages and reports unavailable content gaps', () => {
    const page = { url: 'https://site.test/a', final_url: 'https://site.test/a', title: 'Article', word_count: 100, depth: 1, links: [{ target_url: '/missing', is_internal: true }], http_status: 200 } as never;
    const context = { startUrl: 'https://site.test/', pageCount: 1, graph: { ...linkGraph([page]), downward: new Map() } };
    expect(classifyPage(page, context)).toBe('article');
    const report = buildTopTenContentGap({ phrase: 'coffee', rows: [{ type: 'organic', rank: 1, url: 'https://a.test/' }], evidence: [{ url: 'https://a.test/', fetchedAt: null, error: 'blocked' }], now: () => '2026-10-01T00:00:00.000Z' });
    expect(report).toMatchObject({ status: 'unavailable', availablePages: 0, topics: [] });
    expect(buildTopTenContentGap({ phrase: 'empty', rows: [], evidence: [], now: () => '2026-10-01T00:00:00.000Z' }).topics).toEqual([]);
  });

  it('groups templates by optional skeleton and governs weak clusters', () => {
    expect(patternOf('example.test/a')).toBe('/{var}');
    const pages = [{ url: 'https://site.test/coffee-one', text: 'shared one' }, { url: 'https://site.test/coffee-two', text: 'shared two' }, { url: 'https://site.test/coffee-three', text: 'shared three', domSignature: 'article' }, { url: 'https://site.test/tea-one', text: 'shared one' }, { url: 'https://site.test/tea-two', text: 'shared two' }];
    expect(clusterTemplates(pages).length).toBe(3);
    expect(templateInformationGain({ pattern: '/x', pages: [{ url: '/x', text: '' }] })).toBe(0);
    const weak = clusterTemplates(Array.from({ length: 10 }, (_, index) => ({ url: `/coffee-${index}`, text: 'same boilerplate' })));
    expect(governTemplates(weak)[0]).toMatchObject({ verdict: 'thin-template', action: 'noindex' });
    const limitCluster = [{ pattern: '/p/{var}', pages: Array.from({ length: 10 }, (_, i) => ({ url: `/p/${i}`, text: `shared one two three unique_${i}` })) }];
    expect(governTemplates(limitCluster)[0]).toMatchObject({ action: 'limit' });
    const bloat = clusterTemplates(Array.from({ length: 50 }, (_, index) => ({ url: `/tea-${index}`, text: 'identical bloat text' })));
    expect(governTemplates(bloat)[0]).toMatchObject({ verdict: 'template-bloat' });
  });
});
