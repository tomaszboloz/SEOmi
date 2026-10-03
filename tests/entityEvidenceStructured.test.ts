import { describe, expect, it } from 'vitest';
import { addStructuredEvidence } from '@/services/entityEvidence/structured';
import { createEvidenceState } from '@/services/entityEvidence/state';
import { buildEntityEvidenceGraph } from '@/services/entityEvidenceGraph';
import type { CrawledPageSummary } from '@/types';
import type { TopicalMapDocument } from '@/services/topicalMap';

const entity = { id: 'entity:project', kind: 'entity' as const, label: 'Acme', provenance: 'asserted' as const };
const page = (index: number) => ({ url: `https://example.com/${index}` }) as CrawledPageSummary;
const reference = { format: 'JSON-LD' as const, declaration_index: 1, property: '@id', value: 'urn:entity' };

describe('structured entity evidence contracts', () => {
  it('deduplicates namespace aliases and shares a measured schema node across pages', () => {
    const state = createEvidenceState(entity, 1);
    addStructuredEvidence(state, [
      { ...page(0), schema_types: ['Organization', 'schema:Organization', '  '] },
      { ...page(1), schema_types: ['https://schema.org/Organization'] }, page(2),
    ]);
    expect([...state.schemaNodeIds]).toEqual(['schema:organization']);
    expect([...state.structuredPageIndexes]).toEqual([0, 1]);
    expect(state.edges).toEqual([
      expect.objectContaining({ source: 'page:0', target: 'schema:organization', kind: 'structured', coverage: null }),
      expect.objectContaining({ source: 'page:1', target: 'schema:organization', kind: 'structured', coverage: null }),
    ]);
    expect(state.truncated).toBe(false);
  });

  it('retains an existing schema type when the global unique-type cap is full', () => {
    const state = createEvidenceState(entity, 1);
    addStructuredEvidence(state, [
      { ...page(0), schema_types: Array.from({ length: 200 }, (_, index) => `Type${index}`) },
      { ...page(1), schema_types: ['Type0'] },
    ]);
    expect(state.schemaNodeIds.size).toBe(200);
    expect(state.edges.at(-1)?.target).toBe('schema:type0');
    expect(state.truncated).toBe(false);
  });

  it('reports per-page type and reference overflow and keeps bounded evidence', () => {
    const state = createEvidenceState(entity, 1);
    addStructuredEvidence(state, [{
      ...page(0), schema_types: Array.from({ length: 201 }, (_, index) => `Type${index}`),
      schema_references: Array.from({ length: 301 }, () => reference),
    }]);
    expect(state.schemaNodeIds.size).toBe(200);
    expect(state.schemaReferenceNodeIds.size).toBe(300);
    expect(state.edges).toHaveLength(500);
    expect(state.truncated).toBe(true);
  });

  it('does not add a reference node when no evidence edge slot remains', () => {
    const state = createEvidenceState(entity, 1);
    state.evidenceEdgeCount = state.evidenceEdgeLimit;
    addStructuredEvidence(state, [{ ...page(0), schema_references: [reference] }]);
    expect(state.schemaReferenceNodeIds.size).toBe(0);
    expect(state.edges).toEqual([]);
    expect(state.nodes).toHaveLength(2);
    expect(state.truncated).toBe(true);
  });

  it('reports excluded pages and facts while rejecting missing semantic evidence', () => {
    const document: TopicalMapDocument = {
      schemaVersion: 1, nodes: [], updatedAt: '',
      entity: { name: 'Acme', description: 'Owner description', facts: Array.from({ length: 301 }, (_, index) => ({
        id: String(index), attribute: 'City', value: 'Warszawa', sourceUrl: '', reuseStatus: 'locked' as const,
      })) },
    };
    const graph = buildEntityEvidenceGraph(document, Array.from({ length: 501 }, (_, index) => page(index)));
    expect(graph.comparablePages).toBe(0);
    expect(graph.totalAssertions).toBe(301);
    expect(graph.nodes[0].detail).toBe('Owner description');
    expect(graph.nodes[2].detail).toBeTruthy();
    expect(graph.truncated).toBe(true);
  });
});
