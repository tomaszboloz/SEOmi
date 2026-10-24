import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { SignalsWorkspace } from '@/components/Charts/semanticTopical/signals/SignalsWorkspace';
import type { SemanticMap } from '@/services/semanticGraph/types';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, language: string, words: number): CrawledPageSummary => ({
  url, final_url: url, word_count: words, document_language: language,
  semantic_excerpts: ['same words same words'],
} as unknown as CrawledPageSummary);

const fixture = (): { pages: CrawledPageSummary[]; graph: SemanticMap } => {
  const pages = Array.from({ length: 9 }, (_, i) => page(`https://example.test/city-${i}`, 'en', 1000));
  pages.push(page('https://example.test/city-pl', 'pl', 100));
  const edges = pages.slice(0, -1).map((from, i) => ({
    id: `${from.url}>${pages[i + 1].url}`, source: from.url, target: pages[i + 1].url, anchors: [], links: 1,
  }));
  return {
    pages,
    graph: {
      nodes: pages.map((p) => ({ id: p.url, page: p, clusterId: 'c1', clusterLabel: 'c1', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false })),
      edges, topicEdges: [], totalEdges: edges.length, totalTopicEdges: 0, totalInternalLinks: edges.length,
      clusters: [], hasSemanticTerms: false, truncated: false,
    },
  };
};

describe('coverage 100 signals UI', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('renders ready graph, parity rows, template governance and honest empty producers', () => {
    const { pages, graph } = fixture();
    render(<SignalsWorkspace pages={pages} graph={graph} />);
    expect(screen.getByTestId('signals-workspace')).toBeTruthy();
    expect(screen.getByText('Semantic PageRank')).toBeTruthy();
    expect(screen.getByText(/unknown similarity/)).toBeTruthy();
    expect(screen.getByText('International parity')).toBeTruthy();
    expect(screen.getByText('Shallow')).toBeTruthy();
    expect(screen.getByText('Recommended: noindex this segment')).toBeTruthy();
    expect(screen.getByText(/Not enough comparable SERP snapshots/)).toBeTruthy();
    expect(screen.getByText(/Not enough history/)).toBeTruthy();
  });
});
