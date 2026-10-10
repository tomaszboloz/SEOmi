import { describe, expect, it } from 'vitest';
import { buildEntityEvidenceGraph } from '@/services/entityEvidenceGraph';
import type { CrawledPageSummary } from '@/types';
import type { TopicalMapDocument } from '@/services/topicalMap';

const page = (url: string, terms: string[], title = 'Page') => ({
  url,
  final_url: url,
  title,
  http_status: 200,
  indexability_status: 'index',
  body_truncated: false,
  word_count: 120,
  semantic_terms: terms,
  semantic_links: [],
}) as unknown as CrawledPageSummary;

const document: TopicalMapDocument = {
  schemaVersion: 1,
  entity: {
    name: 'Acme SEO',
    description: 'Local SEO consultancy',
    facts: [{ id: 'fact-city', attribute: 'Siedziba', value: 'Warszawa', sourceUrl: 'https://example.com/about', reuseStatus: 'verified' }],
  },
  nodes: [],
  updatedAt: '2026-09-24T00:00:00.000Z',
};

describe('buildEntityEvidenceGraph', () => {
  it('keeps assertions separate from lexical observations and exposes evidence edges', () => {
    const graph = buildEntityEvidenceGraph(document, [
      { ...page('https://example.com/about', ['acme', 'seo', 'warszawa'], 'O nas'), schema_types: ['https://schema.org/Organization'] } as CrawledPageSummary,
      page('https://example.com/services', ['seo', 'consulting'], 'Usługi'),
      page('https://example.com/empty', [], 'Pusta'),
    ]);

    expect(graph.entityNodeId).toBe('entity:project');
    expect(graph.comparablePages).toBe(2);
    expect(graph.structuredPages).toBe(1);
    expect(graph.schemaTypes).toBe(1);
    expect(graph.totalAssertions).toBe(2);
    expect(graph.observedAssertions).toBe(2);
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'declared', source: 'entity:project', target: 'fact:fact-city' }),
      expect.objectContaining({ kind: 'observed', source: 'fact:fact-city', target: 'page:0', coverage: 1, matchedTerms: ['warszawa'] }),
    ]));
    expect(graph.edges.some((edge) => edge.source === 'entity:name' && edge.target === 'page:0')).toBe(true);
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'structured', source: 'page:0', target: 'schema:organization', evidence: expect.stringContaining('Organization') }),
    ]));
    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'schema', id: 'schema:organization', label: 'Organization', provenance: 'measured' }),
    ]));
    expect(graph.edges.some((edge) => edge.target === 'page:2')).toBe(false);
  });

  it('keeps explicit structured-data identifiers as page-scoped evidence', () => {
    const graph = buildEntityEvidenceGraph(document, [
      {
        ...page('https://example.com/about', ['acme', 'seo'], 'O nas'),
        schema_types: ['Organization'],
        schema_references: [
          { format: 'JSON-LD', declaration_index: 1, property: '@id', value: 'https://example.com/#org' },
          { format: 'JSON-LD', declaration_index: 1, property: 'sameAs', value: 'https://social.example/acme' },
        ],
      } as CrawledPageSummary,
    ]);

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'reference', source: 'page:0', target: 'schema-ref:0:0', evidence: expect.stringContaining('@id') }),
      expect.objectContaining({ kind: 'reference', source: 'page:0', target: 'schema-ref:0:1', evidence: expect.stringContaining('sameAs') }),
    ]));
    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'schema', id: 'schema-ref:0:0', label: '@id: https://example.com/#org' }),
    ]));
  });

  it('does not invent a graph when no entity was asserted', () => {
    const graph = buildEntityEvidenceGraph({ ...document, entity: { ...document.entity, name: '' } }, [page('https://example.com', ['seo'])]);
    expect(graph).toEqual({ nodes: [], edges: [], entityNodeId: null, comparablePages: 0, structuredPages: 0, schemaTypes: 0, observedAssertions: 0, totalAssertions: 0, truncated: false });
  });

  it('observes asserted facts on pages that use another inflection of the same words', () => {
    const polish: TopicalMapDocument = {
      ...document,
      entity: { ...document.entity, facts: [{ id: 'fact-offer', attribute: 'Oferta', value: 'Szkolenia LinkedIn', sourceUrl: '', reuseStatus: 'verified' }] },
    };
    const graph = buildEntityEvidenceGraph(polish, [
      { ...page('https://example.com/oferta', ['szkolenie', 'linkedin']), document_language: 'pl' } as CrawledPageSummary,
    ]);

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'observed', source: 'fact:fact-offer', target: 'page:0', coverage: 1, matchedTerms: ['szkolenia', 'linkedin'] }),
    ]));
  });

  it('excludes error-page terms from comparable entity evidence', () => {
    const graph = buildEntityEvidenceGraph(document, [
      { ...page('https://example.com/missing', ['acme', 'seo', 'warszawa']), http_status: 404 } as CrawledPageSummary,
    ]);

    expect(graph.comparablePages).toBe(0);
    expect(graph.observedAssertions).toBe(0);
    expect(graph.edges.some((edge) => edge.kind === 'observed')).toBe(false);
  });
});
