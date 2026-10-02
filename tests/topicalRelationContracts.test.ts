import { describe, expect, it } from 'vitest';
import { setTopicalNodeParent, setNodeParentFromInput, toggleTopicalLateralRelation } from '@/services/topicalDocument/relations';
import { createEmptyTopicalMap, createTopicalNode } from '@/services/topicalMap';

describe('topical relation contracts', () => {
  it('rejects unknown/self parents and creates or clears valid parent links', () => {
    const nodes = ['a', 'b', 'c'].map((id) => ({ ...createTopicalNode(id), id }));
    const document = { ...createEmptyTopicalMap(), nodes };
    expect(setTopicalNodeParent(document, 'a', 'a')).toBe(document);
    expect(setTopicalNodeParent(document, 'a', 'missing')).toBe(document);
    const linked = setTopicalNodeParent(document, 'a', 'b');
    expect(linked.nodes[0].parentId).toBe('b');
    expect(linked.nodes[1]).toBe(nodes[1]);
    expect(setNodeParentFromInput(linked, 'a', null).nodes[0].parentId).toBeNull();
  });
  it('rejects invalid lateral links and updates both endpoints without changing others', () => {
    const nodes = ['a', 'b', 'c'].map((id) => ({ ...createTopicalNode(id), id }));
    const document = { ...createEmptyTopicalMap(), nodes };
    for (const [left, right] of [['a', 'a'], ['missing', 'b'], ['a', 'missing']]) expect(toggleTopicalLateralRelation(document, left, right)).toBe(document);
    const linked = toggleTopicalLateralRelation(document, 'a', 'b');
    expect(linked.nodes.map((node) => node.relatedNodeIds)).toEqual([['b'], ['a'], []]);
    expect(linked.nodes[2]).toBe(nodes[2]);
    expect(toggleTopicalLateralRelation(linked, 'a', 'b').nodes.map((node) => node.relatedNodeIds)).toEqual([[], [], []]);
  });
});
