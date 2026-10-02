import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildEntityEvidenceGraph } from '@/services/entityEvidenceGraph';
import type { CrawledPageSummary } from '@/types';
import type { TopicalMapDocument } from '@/services/topicalMap';

const document = {
  schemaVersion: 1,
  entity: { name: 'Acme', description: '', facts: [] },
  nodes: [], updatedAt: '',
} as TopicalMapDocument;
const page = (index: number, terms = ['acme']) => ({
  url: `https://example.com/${index}`, semantic_terms: terms,
  schema_types: [], schema_references: [],
}) as unknown as CrawledPageSummary;
const references = (count: number) => Array.from({ length: count }, (_, index) => ({
  format: 'JSON-LD' as const, declaration_index: index, property: '@id', value: `urn:${index}`,
}));

describe('entity evidence bounded inventories', () => {
  it('excludes inventories containing only normalized empty terms from comparable pages', () => {
    const graph = buildEntityEvidenceGraph(document, [page(0, [' ', '!!!', '\u0000']), page(1)]);
    expect(graph.comparablePages).toBe(1);
    expect(graph.observedAssertions).toBe(1);
  });

  it('retains lexical edges to existing pages when schema nodes exceed the old smaller cap', () => {
    const pages = Array.from({ length: 500 }, (_, index) => ({
      ...page(index), schema_types: ['Organization'],
      schema_references: index === 0 ? references(300) : [],
    }));
    const graph = buildEntityEvidenceGraph(document, pages);
    expect(graph.edges.filter((edge) => edge.kind === 'observed')).toHaveLength(500);
    expect(graph.nodes.filter((node) => node.kind === 'page')).toHaveLength(500);
    expect(graph.truncated).toBe(false);
  });

  it('reports a global schema type cap reached across individually small inventories', () => {
    const pages = Array.from({ length: 201 }, (_, index) => ({ ...page(index), schema_types: [`Type${index}`] }));
    const graph = buildEntityEvidenceGraph(document, pages);
    expect(graph.schemaTypes).toBe(200);
    expect(graph.truncated).toBe(true);
  });

  it('reports a global reference cap reached across individually small inventories', () => {
    const graph = buildEntityEvidenceGraph(document, [
      { ...page(0), schema_references: references(200) },
      { ...page(1), schema_references: references(200) },
    ]);
    expect(graph.edges.filter((edge) => edge.kind === 'reference')).toHaveLength(300);
    expect(graph.truncated).toBe(true);
  });

  it('reserves room for declarations without exceeding the global edge budget', () => {
    const pages = Array.from({ length: 500 }, (_, index) => ({
      ...page(index), schema_types: ['Organization', 'Article', 'Person', 'WebPage', 'Thing'],
    }));
    const graph = buildEntityEvidenceGraph(document, pages);
    expect(graph.edges).toHaveLength(2000);
    expect(graph.edges.filter((edge) => edge.kind === 'declared')).toHaveLength(1);
    expect(graph.truncated).toBe(true);
  });

  it('keeps the entity evidence facade and all responsibilities within 150 physical lines', () => {
    const directory = 'src/services/entityEvidence';
    const files = ['src/services/entityEvidenceGraph.ts', ...readdirSync(directory).map((file) => `${directory}/${file}`)];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n').length - Number(source.endsWith('\n'));
      expect(lines, file).toBeLessThanOrEqual(150);
    }
  });
});
