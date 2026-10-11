import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';

const page = (slug: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url: `https://ex.test/tag/${slug}/`, final_url: `https://ex.test/tag/${slug}/`, semantic_language: 'pl', word_count: 300,
  hreflangs: [], semantic_links: [], semantic_terms: [`temat${slug}`], ...patch,
});
const duplicates = (pages: ReturnType<typeof page>[]) => buildTopicalDiagnosis(pages, 'https://ex.test/')
  .verdicts.filter((verdict) => verdict.code === 'near-duplicate');
const simhash = (value: number) => value.toString(16).padStart(16, '0');

describe('near-duplicate verdicts', () => {
  it('reports thirty pages with one content hash as one group, not as 435 pairs', () => {
    const verdicts = duplicates(Array.from({ length: 30 }, (_, index) => page(String(index), { content_hash: 'empty-tag' })));

    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]).toMatchObject({
      severity: 'fix', scope: 'document', scopeId: 'doc-0:same-30',
      evidence: [{ key: 'hash', params: { value: 'empty-tag' } }, { key: 'count', params: { count: 30 } }],
    });
    expect(verdicts[0].urls).toHaveLength(10);
    expect(verdicts[0].urls[0]).toBe('https://ex.test/tag/0/');
  });

  it('joins a chain of nearly identical pages into one group with its widest distance', () => {
    // 0b0000, 0b0001, 0b0111 and 0b1111111: each next page differs from an earlier one by at most 7 bits.
    const verdicts = duplicates([0, 1, 7, 127].map((value, index) => page(String(index), { content_simhash: simhash(value) })));

    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]).toMatchObject({
      severity: 'weak', scopeId: 'doc-0:near-4',
      evidence: [{ key: 'distance', params: { value: 7 } }, { key: 'count', params: { count: 4 } }],
    });
    expect(verdicts[0].urls).toHaveLength(4);
  });

  it('compares an identical group with a near copy once, through its first page', () => {
    const verdicts = duplicates([
      page('a', { content_hash: 'x', content_simhash: simhash(0) }), page('b', { content_hash: 'x', content_simhash: simhash(0) }),
      page('c', { content_hash: 'y', content_simhash: simhash(1) }),
    ]);

    expect(verdicts.map((verdict) => [verdict.severity, verdict.scopeId])).toEqual([['fix', 'doc-0:doc-1'], ['weak', 'doc-0:doc-2']]);
    expect(verdicts[1].evidence).toEqual([{ key: 'distance', params: { value: 1 } }]);
  });

  it('never groups pages of different languages or pages without a usable fingerprint', () => {
    expect(duplicates([
      page('a', { content_hash: 'x', content_simhash: simhash(0) }),
      page('b', { content_hash: 'x', content_simhash: simhash(0), semantic_language: 'en' }),
      page('c', { content_simhash: 'not-a-hash' }), page('d', { content_simhash: simhash(0), semantic_language: 'de' }),
      page('e'), page('f', { content_simhash: simhash(255), semantic_language: 'de' }),
    ])).toEqual([]);
  });
});
