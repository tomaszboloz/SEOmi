import { describe, expect, it } from 'vitest';
import type { ElementDefinition } from 'cytoscape';
import { buildElements } from '@/components/Charts/crawlArchitecture/cytoscapeMap/buildElements';
import { COLLAPSE_THRESHOLD, LABEL_LIMIT, allSections, remapEdges, resolveCollapsed, sectionCounts, sectionId } from '@/components/Charts/crawlArchitecture/cytoscapeMap/sections';
import type { MapEdge, MapNode } from '@/components/Charts/crawlArchitecture/cytoscapeMap/mapTypes';

const node = (id: string, section: string, over: Partial<MapNode> = {}): MapNode => ({
  id, url: `https://a.test${section}/${id}?q=1`, title: '', status: 200, statusClass: '2xx', depth: 1, inlinks: 0, trs: null, section, orphan: false, problem: false, ...over,
});
const nodes = [node('a', '/blog', { inlinks: 5 }), node('b', '/blog'), node('c', '/shop'), node('d', '/')];
const edges: MapEdge[] = [
  { id: 'e1', source: 'a', target: 'b', links: 1 },
  { id: 'e2', source: 'a', target: 'c', links: 2 },
  { id: 'e3', source: 'b', target: 'c', links: 4 },
  { id: 'e4', source: 'c', target: 'd', links: 1 },
];
const ids = (elements: ElementDefinition[], group: string) => elements.filter((e) => e.group === group).map((e) => e.data.id);

describe('sections', () => {
  it('counts multi-page sections only', () => {
    expect(sectionCounts(nodes).get('/blog')).toBe(2);
    expect(allSections(nodes)).toEqual(['/blog']);
    expect(sectionId('/blog')).toBe('sec:/blog');
  });

  it('collapses sections by default only on big sites and flips on toggle', () => {
    expect([...resolveCollapsed(nodes, new Set())]).toEqual([]);
    expect([...resolveCollapsed(nodes, new Set(['/blog']))]).toEqual(['/blog']);
    const big = Array.from({ length: COLLAPSE_THRESHOLD + 1 }, (_, i) => node(`n${i}`, i % 2 ? '/a' : '/b'));
    expect([...resolveCollapsed(big, new Set())].sort()).toEqual(['/a', '/b']);
    expect([...resolveCollapsed(big, new Set(['/a']))]).toEqual(['/b']);
  });

  it('merges parallel edges and drops edges inside a collapsed section', () => {
    const merged = remapEdges(edges, nodes, new Set(['/blog']));
    expect(merged).toEqual([
      { id: 'sec:/blog->c', source: 'sec:/blog', target: 'c', links: 6 },
      { id: 'c->d', source: 'c', target: 'd', links: 1 },
    ]);
  });
});

describe('buildElements', () => {
  it('adds compound parents for expanded multi-page sections when grouped', () => {
    const elements = buildElements(nodes, edges, { grouped: true, collapsed: new Set() });
    expect(ids(elements, 'nodes')).toEqual(['sec:/blog', 'a', 'b', 'c', 'd']);
    expect(elements.find((e) => e.data.id === 'a')!.data.parent).toBe('sec:/blog');
    expect(elements.find((e) => e.data.id === 'c')!.data.parent).toBeUndefined();
    expect(ids(elements, 'edges')).toHaveLength(4);
  });

  it('keeps nodes flat for hierarchy layout', () => {
    const elements = buildElements(nodes, edges, { grouped: false, collapsed: new Set() });
    expect(ids(elements, 'nodes')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('renders a collapsed section as a single sized node with a count label', () => {
    const elements = buildElements(nodes, edges, { grouped: true, collapsed: new Set(['/blog']) });
    const section = elements.find((e) => e.data.id === 'sec:/blog')!;
    expect(section.data).toMatchObject({ kind: 'section', label: '/blog (2)' });
    expect(ids(elements, 'nodes')).toEqual(['sec:/blog', 'c', 'd']);
  });

  it('limits permanent labels to the most linked pages and shortens urls', () => {
    const many = Array.from({ length: LABEL_LIMIT + 20 }, (_, i) => node(`p${i}`, `/s${i}`, { inlinks: i }));
    const labelled = buildElements(many, [], { grouped: false, collapsed: new Set() }).filter((e) => e.data.label);
    expect(labelled).toHaveLength(LABEL_LIMIT);
    expect(buildElements([node('x', '/', { url: 'https://a.test/' })], [], { grouped: false, collapsed: new Set() })[0].data.label).toBe('/');
    expect(buildElements([node('x', '/', { url: 'bad url' })], [], { grouped: false, collapsed: new Set() })[0].data.label).toBe('bad url');
    expect(buildElements([node('x', '/', { url: 'https://a.test' })], [], { grouped: false, collapsed: new Set() })[0].data.label).toBe('/');
  });

  it('handles 6000 pages with progressive collapsing', () => {
    const huge = Array.from({ length: 6000 }, (_, i) => node(`h${i}`, `/s${i % 20}`));
    const hugeEdges = huge.slice(1).map((n, i) => ({ id: `e${i}`, source: huge[i].id, target: n.id, links: 1 }));
    const collapsed = resolveCollapsed(huge, new Set());
    const elements = buildElements(huge, hugeEdges, { grouped: true, collapsed });
    expect(ids(elements, 'nodes')).toHaveLength(20);
    expect(ids(elements, 'edges').length).toBeLessThanOrEqual(400);
  });
});
