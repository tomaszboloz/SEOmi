import { describe, expect, it } from 'vitest';
import { candidatePagePairs } from '@/services/topicalAudit/candidates';
import { page, topic } from './fixtures/semanticAuditContracts';

describe('bounded semantic candidate pairs', () => {
  it('deduplicates hash and SimHash-band candidates in stable order', () => {
    const pages = [0, 1, 2].map((index) => page(`https://site.test/${index}`, [], {
      content_hash: 'same', content_simhash: '0000000000000000',
    }));
    expect(candidatePagePairs(pages, new Map())).toEqual({ pairs: [[0, 1], [0, 2], [1, 2]], truncated: false });
  });

  it('indexes only terms under shared topic identities and ignores invalid fingerprints', () => {
    const pages = [page('https://site.test/a', ['coffee']), page('https://site.test/b', ['coffee']),
      page('https://site.test/c', ['coffee'], { content_simhash: 'broken' })];
    const sharedTopic = topic([]);
    const topics = new Map([[pages[0].url, [sharedTopic]], [pages[1].url, [sharedTopic]],
      [pages[2].url, [{ ...sharedTopic, id: 'another-topic' }]]]);
    expect(candidatePagePairs(pages, topics)).toEqual({ pairs: [[0, 1]], truncated: false });
    expect(candidatePagePairs([], new Map())).toEqual({ pairs: [], truncated: false });
  });

  it('retains the near-duplicate guarantee across eight disjoint bands', () => {
    const pages = [page('https://site.test/a', [], { content_simhash: '0000000000000000' }),
      page('https://site.test/b', [], { content_simhash: '0101010101010100' })];
    expect(candidatePagePairs(pages, new Map()).pairs).toEqual([[0, 1]]);
  });

  it('stops at 250000 exact-hash candidates before lower-priority evidence', () => {
    const pages = Array.from({ length: 708 }, (_, index) => page(`https://site.test/${index}`, [], { content_hash: 'same' }));
    const result = candidatePagePairs(pages, new Map());
    expect(result.pairs).toHaveLength(250000);
    expect(result.truncated).toBe(true);
    expect(result.pairs[0]).toEqual([0, 1]);
    expect(new Set(result.pairs.map(([left, right]) => `${left}:${right}`)).size).toBe(250000);
  });

  it('bounds topical candidates before comparing SimHash and marks real omission', () => {
    const pages = Array.from({ length: 708 }, (_, index) => page(`https://site.test/${index}`, ['coffee']));
    const sharedTopic = topic([]);
    const topics = new Map(pages.map((entry) => [entry.url, [sharedTopic]]));
    const result = candidatePagePairs(pages, topics);
    expect(result.pairs).toHaveLength(250000);
    expect(result.truncated).toBe(true);
  });
});
