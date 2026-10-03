import { describe, expect, it } from 'vitest';
import { entityAssertions, addAssertionEvidence } from '@/services/entityEvidence/assertions';
import { createEvidenceState, ensurePageNode, reserveEvidenceEdge } from '@/services/entityEvidence/state';
import type { CrawledPageSummary } from '@/types';

const entity = { id: 'entity:project', kind: 'entity' as const, label: 'Acme', provenance: 'asserted' as const };
const page = (terms: string[]) => ({ url: 'https://example.com', title: '', semantic_terms: terms }) as CrawledPageSummary;

describe('entity assertion and page ownership contracts', () => {
  it('preserves fact identity, source and first 300 assertions in input order', () => {
    const facts = Array.from({ length: 301 }, (_, index) => ({
      id: String(index), attribute: 'City', value: 'Łódź', sourceUrl: '', reuseStatus: 'locked' as const,
    }));
    const assertions = entityAssertions({ schemaVersion: 1, nodes: [], updatedAt: '', entity: { name: ' Acme ', description: '', facts } });
    expect(assertions).toHaveLength(301);
    expect(assertions[0]).toEqual({ id: 'entity:name', label: 'Acme', terms: ['acme'] });
    expect(assertions[1]).toEqual({ id: 'fact:0', label: 'City: Łódź', terms: ['łódź'], fact: facts[0] });
    expect(assertions.at(-1)?.id).toBe('fact:299');
  });

  it('owns independent state and reserves the exact evidence budget', () => {
    const state = createEvidenceState(entity, 1);
    expect(state.nodes).toEqual([entity]);
    expect(state.evidenceEdgeLimit).toBe(1999);
    expect(reserveEvidenceEdge(state)).toBe(true);
    state.evidenceEdgeCount = 1998;
    expect(reserveEvidenceEdge(state)).toBe(true);
    expect(reserveEvidenceEdge(state)).toBe(false);
    expect(state.evidenceEdgeCount).toBe(1999);
    expect(state.truncated).toBe(true);
    expect(createEvidenceState(entity, 1).truncated).toBe(false);
  });

  it('reuses a page node by selected-page index and retains its original measured label', () => {
    const state = createEvidenceState(entity, 1);
    expect(ensurePageNode(state, page([]), 2)).toBe('page:2');
    expect(ensurePageNode(state, { ...page([]), title: 'Later title' }, 2)).toBe('page:2');
    expect(ensurePageNode(state, { ...page([]), title: ' Title ' }, 3)).toBe('page:3');
    expect(state.nodes.slice(1)).toEqual([
      expect.objectContaining({ id: 'page:2', label: 'https://example.com', provenance: 'measured' }),
      expect.objectContaining({ id: 'page:3', label: 'Title', provenance: 'measured' }),
    ]);
  });

  it('keeps partial lexical evidence separate from complete assertion counts', () => {
    const state = createEvidenceState(entity, 3);
    const terms = Array.from({ length: 12 }, (_, index) => `term${index}`);
    const count = addAssertionEvidence(state, [
      { id: 'complete', label: 'Complete', terms },
      { id: 'partial', label: 'Partial', terms: ['term0', 'absent', 'other', 'missing'] },
      { id: 'below', label: 'Below threshold', terms: ['term0', 'a', 'b', 'c', 'd'] },
    ], [page(terms), page([])], entity.id);
    expect(count).toBe(1);
    expect(state.edges.filter((edge) => edge.kind === 'declared')).toHaveLength(3);
    expect(state.edges.filter((edge) => edge.kind === 'observed')).toEqual([
      expect.objectContaining({ source: 'complete', coverage: 1, matchedTerms: terms.slice(0, 8) }),
      expect.objectContaining({ source: 'partial', coverage: 0.25, matchedTerms: ['term0'] }),
    ]);
  });

  it('counts complete evidence even when the visible graph budget is exhausted', () => {
    const state = createEvidenceState(entity, 1);
    state.evidenceEdgeCount = state.evidenceEdgeLimit;
    expect(addAssertionEvidence(state, [{ id: 'fact', label: 'Acme', terms: ['acme'] }], [page(['acme'])], entity.id)).toBe(1);
    expect(state.edges).toEqual([expect.objectContaining({ kind: 'declared', target: 'fact' })]);
    expect(state.truncated).toBe(true);
  });
});
