import { expect, it } from 'vitest';
import { buildSemanticMap } from '@/services/semanticMap';
import { createEmptyTopicalMap, importCrawlClusters } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';

it('does not join unrelated legacy pages through an absent final URL', () => {
  const member = { url: 'https://site.test/coffee', semantic_terms: ['coffee'], semantic_links: [] } as unknown as CrawledPageSummary;
  const unrelated = { url: 'https://site.test/widgets', semantic_terms: ['widgets'], semantic_links: [] } as unknown as CrawledPageSummary;
  const map = buildSemanticMap([member], member.url);
  const result = importCrawlClusters(createEmptyTopicalMap(), map, [member, unrelated], 'run');
  expect(result.nodes).toHaveLength(1);
  expect(result.nodes[0].sourceUrls).toEqual([member.url]);
});

it('imports URL-only members without inventing lexical evidence', () => {
  const member = { url: 'https://site.test/page', semantic_links: [] } as unknown as CrawledPageSummary;
  const map = buildSemanticMap([member], member.url);
  const result = importCrawlClusters(createEmptyTopicalMap(), map, [member], 'run');
  expect(result.nodes[0].evidenceTerms).toEqual([]);
  expect(result.nodes[0].sourceUrls).toEqual([member.url]);
});
