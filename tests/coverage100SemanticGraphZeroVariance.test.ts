import { describe, expect, it } from 'vitest';
import { clusterByAverageLinkage } from '@/services/semanticGraph/clustering';
import { calculatePageRank } from '@/services/semanticGraph/pageRank';
import { buildSemanticTopics } from '@/services/semanticGraph/topics';
import { normalizeGraphUrl } from '@/services/semanticGraph/urls';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, terms: string[] = []): CrawledPageSummary => ({
  url,
  final_url: url,
  semantic_terms: terms,
  links: [],
  http_status: 200,
} as unknown as CrawledPageSummary);

describe('coverage100SemanticGraphZeroVariance', () => {
  it('handles empty graphs, single-node graphs, and disconnected multi-component graphs', () => {
    const emptyClusters = clusterByAverageLinkage(0, []);
    expect(emptyClusters).toEqual([]);

    const singleClusters = clusterByAverageLinkage(1, []);
    expect(singleClusters).toEqual([0]);

    const disconnected = clusterByAverageLinkage(2, []);
    expect(disconnected).toEqual([0, 1]);
  });

  it('sanitizes zero-variance vectors', () => {
    const zeroVarTopics = buildSemanticTopics([
      page('https://a.test', []),
      page('https://b.test', []),
    ]);
    expect(zeroVarTopics).toBeDefined();

    const pr = calculatePageRank(
      [{ id: 'https://a.test' }, { id: 'https://b.test' }],
      [{ source: 'https://a.test', target: 'https://b.test', weight: 1 }],
      { damping: 0.85 }
    );
    expect(pr.scores[0].score).toBeGreaterThan(0);
  });

  it('partitions graphs with uniform edge weights vs positive weights', () => {
    const uniformClusters = clusterByAverageLinkage(2, [
      { left: 0, right: 1, similarity: 0.5 },
    ], 0.1);
    expect(uniformClusters).toEqual([0, 0]);

    const positiveWeightPr = calculatePageRank(
      [{ id: 'https://a.test' }, { id: 'https://b.test' }, { id: 'https://c.test' }],
      [
        { source: 'https://a.test', target: 'https://b.test', weight: 1 },
        { source: 'https://b.test', target: 'https://c.test', weight: 1 }
      ],
      { damping: 0.85 }
    );
    expect(positiveWeightPr.scores.length).toBe(3);
    expect(normalizeGraphUrl('   ')).toBe('');
  });
});
