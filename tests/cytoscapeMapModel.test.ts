import { describe, expect, it } from 'vitest';
import type { SemanticPageNode } from '@/services/semanticMap';
import { applyMapFilters, buildMapNodes, keepEdges, matchIds, maxDepthOf, sectionOf, statusClassOf } from '@/components/Charts/crawlArchitecture/cytoscapeMap/mapNodes';
import { emptyFilters } from '@/components/Charts/crawlArchitecture/cytoscapeMap/mapTypes';
import { nodeColor, nodeSize, statusColor } from '@/components/Charts/crawlArchitecture/cytoscapeMap/nodeStyle';
import { layoutOptions } from '@/components/Charts/crawlArchitecture/cytoscapeMap/layoutOptions';

const sem = (id: string, url: string, over: Record<string, unknown> = {}, orphan = false, inlinks = 0): SemanticPageNode => ({
  id, clusterId: 'c', clusterLabel: 'C', semanticSignalCount: 1, incomingContentLinks: inlinks, orphan,
  page: { url, final_url: url, http_status: 200, depth: 1, title: 'T', ...over } as never,
});

describe('statusClassOf and sectionOf', () => {
  it.each([[200, '2xx'], [301, '3xx'], [404, '4xx'], [503, '5xx'], [0, 'other'], [700, 'other']])('classifies %i as %s', (status, expected) => {
    expect(statusClassOf(status)).toBe(expected);
  });

  it('groups urls by first path segment', () => {
    expect(sectionOf('https://a.test/blog/post')).toBe('/blog');
    expect(sectionOf('https://a.test/')).toBe('/');
    expect(sectionOf('not a url')).toBe('/');
  });
});

describe('buildMapNodes', () => {
  const nodes = [
    sem('a', 'https://a.test/blog/x', {}, false, 3),
    sem('b', 'https://a.test/blog/y', { http_status: 404, title: null }),
    sem('c', 'https://a.test/shop/z', { final_url: 'https://a.test/shop/final' }, true),
    sem('d', 'https://a.test/shop/w', { depth: 4 }),
  ];
  const built = buildMapNodes(nodes, { 'https://a.test/blog/x': 80, 'https://a.test/shop/final': 10, 'https://a.test/shop/w': 55 });

  it('maps TRS, status, orphan and problem flags', () => {
    expect(built.map((node) => node.trs)).toEqual([80, null, 10, 55]);
    expect(built.map((node) => node.problem)).toEqual([false, true, true, false]);
    expect(built[1]).toMatchObject({ title: '', statusClass: '4xx', inlinks: 0, section: '/blog' });
  });

  it('flags a low TRS page as a problem', () => {
    expect(buildMapNodes([sem('a', 'https://a.test/x')], { 'https://a.test/x': 39 })[0].problem).toBe(true);
  });

  it('filters by status, depth and problems', () => {
    expect(applyMapFilters(built, emptyFilters())).toHaveLength(4);
    expect(applyMapFilters(built, { ...emptyFilters(), statuses: ['4xx'] }).map((n) => n.id)).toEqual(['b']);
    expect(applyMapFilters(built, { ...emptyFilters(), maxDepth: 1 }).map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(applyMapFilters(built, { ...emptyFilters(), problemsOnly: true }).map((n) => n.id)).toEqual(['b', 'c']);
    expect(maxDepthOf(built)).toBe(4);
    expect(maxDepthOf([])).toBe(0);
  });

  it('keeps only edges between remaining nodes and finds highlight matches', () => {
    const edges = [{ id: 'e1', source: 'a', target: 'b', links: 1 }, { id: 'e2', source: 'a', target: 'zzz', links: 1 }];
    expect(keepEdges(edges, built)).toEqual([edges[0]]);
    expect([...matchIds(built, ' SHOP ')]).toEqual(['c', 'd']);
    expect(matchIds(built, '  ').size).toBe(0);
  });
});

describe('node style and layout options', () => {
  const base = buildMapNodes([sem('a', 'https://a.test/x')], {})[0];

  it('colours by TRS band when known, else by HTTP status', () => {
    expect(nodeColor({ ...base, trs: 90 })).toBe('#34d399');
    expect(nodeColor({ ...base, trs: 65 })).toBe('#a3e635');
    expect(nodeColor({ ...base, trs: 45 })).toBe('#fbbf24');
    expect(nodeColor({ ...base, trs: 5 })).toBe('#fb7185');
    expect(nodeColor({ ...base, trs: -5 })).toBe('#fb7185');
    expect(nodeColor(base)).toBe(statusColor('2xx'));
  });

  it('scales size with inlinks and caps it', () => {
    expect(nodeSize(0)).toBe(10);
    expect(nodeSize(-3)).toBe(10);
    expect(nodeSize(16)).toBe(30);
    expect(nodeSize(1_000_000)).toBe(46);
  });

  it('picks dagre for hierarchy and fcose for force, drafting huge graphs', () => {
    expect(layoutOptions('hierarchy', 10)).toMatchObject({ name: 'dagre', rankDir: 'TB' });
    expect(layoutOptions('force', 10)).toMatchObject({ name: 'fcose', quality: 'default' });
    expect(layoutOptions('force', 6000)).toMatchObject({ quality: 'draft' });
  });
});
