// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSprsInput, buildSprsReport } from '@/services/sprs/report';
import { edgePageSimilarity } from '@/services/sprs/embeddingSimilarity';
import type { SemanticMap, SemanticPageNode } from '@/services/semanticGraph/types';
import type { EmbeddingSet } from '@/services/semanticSource/types';
import type { CrawledPageSummary } from '@/types';

const A = 'https://a.test/', B = 'https://a.test/b';
const page = (url: string, final?: string) => ({ url, final_url: final ?? url, http_status: 200 }) as unknown as CrawledPageSummary;
const node = (url: string, final?: string): SemanticPageNode => ({ id: url, page: page(url, final), clusterId: 'c', clusterLabel: 'c', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false });
const set = (byUrl: Record<string, number[]>): EmbeddingSet => ({ providerId: 'ollama', model: 'm', dimensions: 2, byUrl: new Map(Object.entries(byUrl)) });

describe('edgePageSimilarity (#71, optional embeddings)', () => {
  it('keeps the lexical value without embeddings or without both vectors', () => {
    expect(edgePageSimilarity(0.4, node(A), node(B))).toBe(0.4);
    expect(edgePageSimilarity(0.4, node(A), node(B), set({ 'https://a.test/': [1, 0] }))).toBe(0.4);
    expect(edgePageSimilarity(undefined, node(A), node(B), set({}))).toBeUndefined();
  });
  it('blends lexical and cosine, and uses a clipped cosine alone when lexical is unknown', () => {
    const vectors = set({ 'https://a.test/': [1, 0], 'https://a.test/b': [1, 0] });
    expect(edgePageSimilarity(0.2, node(A), node(B), vectors)).toBeCloseTo(0.6);
    expect(edgePageSimilarity(undefined, node(A), node(B), vectors)).toBeCloseTo(1);
    expect(edgePageSimilarity(undefined, node(A), node(B), set({ 'https://a.test/': [1, 0], 'https://a.test/b': [-1, 0] }))).toBe(0);
  });
  it('looks pages up by their final URL when present', () => {
    expect(edgePageSimilarity(undefined, node(A, 'https://a.test/final'), node(B), set({ 'https://a.test/final': [0, 1], 'https://a.test/b': [0, 1] }))).toBeCloseTo(1);
  });
});

describe('buildSprsInput with embeddings', () => {
  const graph = { nodes: [node(A), node(B)], edges: [{ id: 'e', source: A, target: B, links: 1 }], topicEdges: [] } as unknown as SemanticMap;
  it('leaves the edge unmeasured without embeddings and measured with them', () => {
    expect(buildSprsInput(graph).edges[0].similarity).toBeUndefined();
    const withVectors = buildSprsInput(graph, set({ 'https://a.test/': [1, 0], 'https://a.test/b': [0, 1] }));
    expect(withVectors.edges[0].similarity).toBe(0);
  });
  it('threads the embedding set through the report', () => {
    const report = buildSprsReport(graph, set({ 'https://a.test/': [1, 0], 'https://a.test/b': [1, 0] }));
    expect(report.status).toBe('ready');
    expect(report.unknownSimilarityEdges).toBe(0);
    expect(buildSprsReport(graph).unknownSimilarityEdges).toBe(1);
  });
});
