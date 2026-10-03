import { expect, it, vi } from 'vitest';
import { createEmptyTopicalMap, createTopicalNode, setTopicalNodeParent } from '@/services/topicalMap';

it('rejects attachment to an existing foreign parent cycle with bounded traversal', () => {
  const nodes = ['a', 'b', 'c'].map((id) => ({ ...createTopicalNode(id), id }));
  nodes[1].parentId = 'c';
  nodes[2].parentId = 'b';
  const document = { ...createEmptyTopicalMap(), nodes };
  const find = nodes.find.bind(nodes);
  let visits = 0;
  const spy = vi.spyOn(nodes, 'find').mockImplementation((predicate) => {
    if (++visits > 6) throw Error('unbounded parent traversal');
    return find(predicate);
  });
  try {
    expect(setTopicalNodeParent(document, 'a', 'b')).toBe(document);
    expect(visits).toBeLessThanOrEqual(3);
  } finally { spy.mockRestore(); }
});
