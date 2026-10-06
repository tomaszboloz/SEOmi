import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { EmbeddingClusteringResult } from '@/services/embeddingClustering';
import { EmbeddingClusterResults } from '@/components/Keywords/embeddingClustering/EmbeddingClusterResults';
import { HybridPairEvidence } from '@/components/Keywords/embeddingClustering/HybridPairEvidence';

type Pair = NonNullable<EmbeddingClusteringResult['pairEvidence']>[number];
const source = (provider: string | null): NonNullable<Pair['sourceA']> => ({
  kind: 'json-import', provider, sourceUrl: null, countryCode: 'PL', locationCode: 2616,
  languageCode: 'pl', capturedAt: null, retrievedAt: null, availability: 'complete', reason: null,
});
const pair = (overrides: Partial<Pair> = {}): Pair => ({
  keywordA: 'seo', keywordB: 'audyt', semanticCosine: 0.8, serpJaccard: 0.25, score: 0.635,
  mode: 'hybrid', sharedUrls: ['https://example.test/shared'], weights: { semantic: 0.7, serp: 0.3 },
  appliedWeights: { semantic: 0.7, serp: 0.3 }, reasons: ['serp-compatible'],
  sourceA: source('Google'), sourceB: source('DataForSEO'), ...overrides,
});
const result = (pairEvidence?: Pair[], overrides: Partial<EmbeddingClusteringResult> = {}): EmbeddingClusteringResult => ({
  method: 'embeddings', provider: 'hybrid', model: 'local', threshold: 0.8,
  clusters: [{ id: 'cluster-1', keywords: ['seo', 'audyt'], label: 'SEO', cohesion: 0.9 }],
  unclusteredKeywords: [], analyzedAt: '2026-10-06T12:00:00.000Z', scoringMode: 'embedding-serp',
  ...(pairEvidence === undefined ? {} : { pairEvidence }), ...overrides,
});

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('hybrid pair evidence UI', () => {
  it('renders unknown SERP score, unknown providers and omits empty shared URLs', () => {
    render(<HybridPairEvidence pairs={[pair({ mode: 'semantic-only', serpJaccard: null, score: 0.81234, sharedUrls: [], sourceA: null, sourceB: null, reasons: ['serp-no-results'] })]} />);
    expect(screen.getByText('Qualifying pairs: 1')).toBeTruthy();
    expect(screen.getByText('Semantic: 0.800 · SERP: Unknown · score: 0.812')).toBeTruthy();
    expect(screen.getByText('Sources: Unknown / Unknown')).toBeTruthy();
    expect(screen.queryByText('https://example.test/shared')).toBeNull();
  });

  it('renders observed score, known and unknown providers, and shared URLs', () => {
    render(<HybridPairEvidence pairs={[pair({ sourceA: source('Google'), sourceB: null, sharedUrls: ['https://one.test', 'https://two.test'] })]} />);
    expect(screen.getByText('Semantic: 0.800 · SERP: 0.250 · score: 0.635')).toBeTruthy();
    expect(screen.getByText('Sources: Google / Unknown')).toBeTruthy();
    expect(screen.getByText('https://one.test · https://two.test')).toBeTruthy();
  });

  it('caps visible rows at 100 and reports an empty qualifying set', () => {
    const pairs = Array.from({ length: 101 }, (_, index) => pair({ keywordA: `a-${index}`, keywordB: `b-${index}` }));
    const { rerender } = render(<HybridPairEvidence pairs={pairs} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(100);
    expect(screen.getByText('Showing the first 100 pairs.')).toBeTruthy();
    rerender(<HybridPairEvidence pairs={[]} />);
    expect(screen.getByText('Qualifying pairs: 0')).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('renders pair evidence through the embedding results integration', () => {
    render(<EmbeddingClusterResults result={result([pair()])} />);
    expect(screen.getByRole('heading', { name: 'Embedding groups' })).toBeTruthy();
    expect(screen.getByText('seo ↔ audyt · hybrid')).toBeTruthy();
    expect(screen.getByText('SEO')).toBeTruthy();
  });

  it('renders empty clusters and low-cohesion fallback labels with unclustered keywords', () => {
    const { rerender } = render(<EmbeddingClusterResults result={result(undefined, { clusters: [], unclusteredKeywords: [] })} />);
    expect(screen.getByText(/No keyword pairs meet the threshold/)).toBeTruthy();
    rerender(<EmbeddingClusterResults result={result([], {
      clusters: [{ id: 'weak', keywords: ['one', 'two'], label: null, cohesion: 0.2 }],
      unclusteredKeywords: ['orphan'],
    })} />);
    expect(screen.getByText('Cluster 1')).toBeTruthy();
    expect(screen.getByText('cohesion 20%')).toBeTruthy();
    expect(screen.getByText('orphan')).toBeTruthy();
  });
});
