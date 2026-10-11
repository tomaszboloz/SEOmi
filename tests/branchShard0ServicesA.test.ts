import { describe, expect, it, vi } from 'vitest';
import type { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';
import type { SemanticTermInventory } from '@/services/semanticGraph/terms';
import { getBacklinkProfile } from '@/services/dataforseo/dataforseoBacklinks';
import { getKeywordIdeas } from '@/services/dataforseo/dataforseoKeywords';
import { scoreHybridPair } from '@/services/embeddings/hybridSerp';
import { fetchFreeSuggestions } from '@/services/freeSuggestions/transport';
import { clusterKeywordsBySerpOverlap } from '@/services/keywordClustering';
import { clusterLabel } from '@/services/semanticGraph/labels';
import { uniqueSemanticTerms } from '@/services/semanticText';
import { buildTermStatistics } from '@/services/topicalDiagnosis/similarity';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { buildTopics } from '@/services/topicalDiagnosis/topics';
import { MAX_TOPIC_PAIRS } from '@/services/topicalDiagnosis/thresholds';
import { createCrawlPageFixture } from './fixtures/crawl';

const client = (...responses: unknown[]) => {
  const post = vi.fn().mockImplementation(async () => responses.shift());
  return { post } as unknown as DataForSEOCore;
};

describe('branch shard 0 services', () => {
  it('reports a null subnet count and null dofollow ratio when the provider omits them', async () => {
    const profile = await getBacklinkProfile(client(
      [{ backlinks: 0, referring_domains: 0, rank: 1 }],
      [{ items: [] }],
      [{ items: [] }],
    ), 'empty.test');
    expect(profile).toMatchObject({ referring_subnets: null, dofollow_ratio: null });
    const unknownDofollow = await getBacklinkProfile(client(
      [{ backlinks: 5, referring_domains: 1, rank: 1, referring_links_attributes: 'bad' }],
      [{ items: [] }],
      [{ items: [] }],
    ), 'noratio.test');
    expect(unknownDofollow?.dofollow_ratio).toBeNull();
  });

  it('accepts a known empty envelope and zero-fills missing monthly search volumes', async () => {
    expect(await getKeywordIdeas(client([{ items: [] }]), 'seo', 2616)).toEqual([]);
    const ideas = await getKeywordIdeas(client([{ keyword: 'seo', monthly_searches: [{ year: 2026, month: 1 }, { year: 2026, month: 2, search_volume: 7 }] }]), 'seo', 2616);
    expect(ideas[0].trend).toEqual([0, 7]);
  });

  it('rejects hybrid keywords that are not strings', () => {
    expect(() => scoreHybridPair({ keyword: 5 as unknown as string, vector: [1] }, { keyword: 'a', vector: [1] }))
      .toThrow('Hybrid keywords must be strings');
  });

  describe('free suggestions transport', () => {
    const request = { feed: 'google-suggestions' as const, geo: 'PL', keyword: 'seo', language: 'pl' };
    it('only supports the Google Suggestions feed', async () => {
      await expect(fetchFreeSuggestions({ ...request, feed: 'bing-serp' } as never, vi.fn()))
        .rejects.toThrow('Free suggestions transport supports Google Suggestions only');
    });
    it('converts non-Error and Error invoke failures into an error outcome', async () => {
      const text = await fetchFreeSuggestions(request, vi.fn().mockRejectedValue('native offline'));
      expect(text).toMatchObject({ status: 'error', result: null, response: { status: 'error', body: null, httpStatus: null, error: 'native offline' } });
      const err = await fetchFreeSuggestions(request, vi.fn().mockRejectedValue(new Error('boom')));
      expect(err.response.error).toBe('boom');
    });
  });

  it('does not re-union keywords that are already in one cluster', () => {
    const urls = ['https://a.test/1', 'https://a.test/2'];
    const result = clusterKeywordsBySerpOverlap([
      { keyword: 'one', urls }, { keyword: 'two', urls }, { keyword: 'three', urls },
    ] as never, 1);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].keywords).toHaveLength(3);
  });

  it('breaks equal cluster-label scores alphabetically', () => {
    const inventory = {
      termsByPage: [['b', 'a'], ['a', 'b']],
      topicalTermsByPage: [['b', 'a'], ['a', 'b']],
      inverseFrequency: () => 1,
      displayTerm: (term: string) => term.toUpperCase(),
    } as unknown as SemanticTermInventory;
    expect(clusterLabel([0, 1], inventory)).toBe('A / B');
  });

  it('skips blank terms when de-duplicating semantic terms', () => {
    expect(uniqueSemanticTerms(['  ', '', 'szkolenie'], 'pl')).toEqual(['szkolenie']);
  });

  it('retains every qualifying pair inside the supported document bound', () => {
    const count = 110;
    const pages = Array.from({ length: count }, (_, index) => createCrawlPageFixture({
      url: `https://ex.test/blog/p${index}/`, final_url: `https://ex.test/blog/p${index}/`, semantic_language: 'pl', semantic_terms: ['alfa', 'beta', 'gamma', `u${index}`],
    }));
    const documents = buildDiagnosisDocuments(pages, 'https://ex.test/').documents;
    const stats = buildTermStatistics(documents, new Set());
    const similarity = vi.fn(() => 0.5);
    const build = buildTopics(documents, new Map(), stats, similarity);
    expect(build.pairs.length).toBe(count * (count - 1) / 2);
    expect(build.pairs.length).toBeLessThanOrEqual(MAX_TOPIC_PAIRS);
    expect(build.truncated).toBe(false);
  });
});
