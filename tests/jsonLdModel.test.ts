// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { declaredNodes, graphItems, isJsonLdNode, nodeAndGraph, nodeId, nodeTypes, parseJsonLd } from '@/services/jsonLd/model';

describe('single JSON-LD model (#106)', () => {
  it('flattens @graph items, ignoring non-object entries', () => {
    const value = { '@graph': [{ '@id': 'a' }, 5, null, [1], { '@id': 'b' }] };
    expect(graphItems(value).map((node) => node['@id'])).toEqual(['a', 'b']);
    expect(graphItems({ '@graph': 'no' })).toEqual([]);
    expect(graphItems('text')).toEqual([]);
    expect(graphItems([{ '@graph': [{}] }])).toEqual([]);
  });
  it('declared nodes use the graph or the node itself', () => {
    expect(declaredNodes({ '@graph': [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(declaredNodes({ '@type': 'Thing' })).toEqual([{ '@type': 'Thing' }]);
    expect(declaredNodes(undefined)).toEqual([]);
    expect(nodeAndGraph({ x: 1, '@graph': [{ y: 2 }] })).toEqual([{ x: 1, '@graph': [{ y: 2 }] }, { y: 2 }]);
    expect(nodeAndGraph(null)).toEqual([]);
    expect(isJsonLdNode([])).toBe(false);
  });
  it('reads types, ids and parses safely', () => {
    expect(nodeTypes({ '@type': 'Product' })).toEqual(['Product']);
    expect(nodeTypes({ '@type': ['A', 3, 'B'] })).toEqual(['A', 'B']);
    expect(nodeTypes({})).toEqual([]);
    expect(nodeId({ '@id': ' #x ' })).toBe('#x');
    expect(nodeId({ '@id': '  ' })).toBeUndefined();
    expect(nodeId({ '@id': 4 })).toBeUndefined();
    expect(parseJsonLd('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonLd('{bad')).toBeNull();
  });
});
