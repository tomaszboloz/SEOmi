import { describe, expect, it } from 'vitest';
import type { FocusPage } from '@/services/siteFocus';
import { buildPageDetails, relevanceOf } from '@/services/siteFocus/alignment';
import { clusterTerms } from '@/services/siteFocus/cluster';
import { chooseCore } from '@/services/siteFocus/coreTopic';
import { prepare } from '@/services/siteFocus/evaluate';
import { brandKeys, idf } from '@/services/siteFocus/terms';
import { legacyPage } from './siteFocusFixtures';
import { START, crafted } from './siteFocusBranchesHelpers';

describe('alignment fallbacks', () => {
  it('scales relevance for core, tail and foreign terms', () => {
    const { model } = crafted();
    expect(relevanceOf('a', model, 4)).toBe(100);
    expect(relevanceOf('a', { ...model, coreWeights: new Map() }, 4)).toBe(45);
    expect(relevanceOf('nothing', model, 4)).toBe(30);
    expect(relevanceOf('f1', model, 4)).toBe(15);
  });

  it('falls back through surfaces, entries and keys, and orders ties by label', () => {
    const { page, model } = crafted();
    const parts = { trs: 0, similarity: 0, keywordOverlap: 0, semanticDrift: 0, foreignMass: new Map([['x', 5], ['y', 5], ['gone', 5]]),
      weights: new Map([['a', 9], ['f1', 3], ['f2', 3], ['loose', 3]]) };
    const labels = new Map([['x', 'Bravo'], ['y', 'Alpha']]);
    const details = buildPageDetails(page, parts, model, new Map([['f2', 'fox']]), labels, { semantic_excerpts: undefined } as FocusPage);
    expect(details.keywordsFound).toEqual([{ term: 'alpha', count: 2 }]);
    expect(details.offTopicKeywords.map((item) => [item.term, item.count, item.cluster])).toEqual([['f1', 0, 'Bravo'], ['fox', 0, 'Alpha'], ['loose', 0, '']]);
    expect(details.foreignClusters.map((item) => item.label)).toEqual(['Alpha', 'Bravo', 'gone']);
    expect(details.alignment.map((row) => row.term)).toEqual(['alpha', 'f1', 'fox', 'loose']);
  });
});

describe('term helpers', () => {
  it('has no brand for hosts without a registrable domain and idf for unseen keys', () => {
    expect(brandKeys('http://127.0.0.1/', 'en').size).toBe(0);
    expect(brandKeys('not a url', 'en').size).toBe(0);
    expect(idf({ pageCount: 3, documentFrequency: new Map() }, 'new')).toBeCloseTo(Math.log(4));
    expect(idf({ pageCount: 0, documentFrequency: new Map([['k', 1]]) }, 'k')).toBeCloseTo(Math.log(2));
  });

  it('prepares pages without an explicit language and without titles', () => {
    const page = legacyPage('diabetes.test', '/x', undefined as unknown as string, ['insulin therapy', 'glucose meter']);
    expect(prepare([page], START, undefined)[0].terms.entries.size).toBeGreaterThan(0);
  });
});

describe('clustering and core topic fallbacks', () => {
  const vectors = [new Map([['a', 1], ['b', 1]]), new Map([['a', 1], ['b', 1]]), new Map([['c', 1], ['d', 1]])];
  it('blends valid similarity hook values and ignores invalid ones', () => {
    const terms = ['a', 'b', 'c', 'd'].map((key) => ({ key, weight: 1 }));
    const valid = clusterTerms(terms, vectors, { similarity: () => 0.9, cut: 0.2 });
    expect(valid.clusters.length).toBeGreaterThan(0);
    const mixed = clusterTerms(terms, vectors, { similarity: (left) => (left === 'a' ? 'x' as unknown as number : Number.NaN), cut: 0.2 });
    expect(mixed.clusters.length).toBeGreaterThan(0);
  });

  it('orders equal-weight clusters by their first key', () => {
    const terms = ['d', 'c', 'b', 'a'].map((key) => ({ key, weight: 1 }));
    const same = [new Map([['a', 1], ['b', 1]]), new Map([['c', 1], ['d', 1]]), new Map([['a', 1], ['b', 1]]), new Map([['c', 1], ['d', 1]])];
    const { clusters } = clusterTerms(terms, same);
    expect(clusters.map((cluster) => cluster.keys[0])).toEqual(['a', 'c']);
  });

  it('treats a manual topic of only noise like no manual topic', () => {
    const clusters = [{ id: 'c1', keys: ['a', 'b'], weight: 2 }];
    expect(chooseCore(clusters, new Map([['a', 1], ['b', 1]]), '', 'en').manual).toBeUndefined();
    expect(chooseCore([], new Map(), undefined, 'en').core.id).toBe('c1');
  });
});
