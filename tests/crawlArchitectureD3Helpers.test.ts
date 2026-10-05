import { beforeEach, expect, it, vi } from 'vitest';
import { forceSimulation } from 'd3-force';
import { applySimulationForces, buildSimulationNodesAndLinks, setupDragBehavior } from '@/components/Charts/crawlArchitecture/CrawlArchitectureD3Helpers';
import { CLUSTER_COLORS } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';
import type { SimNode } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';

const handlers = vi.hoisted(() => ({} as Record<string, (e: unknown, n: unknown) => void>));
vi.mock('d3-drag', () => ({ drag: () => { const b = { on: (name: string, fn: never) => { handlers[name] = fn; return b; } }; return b; } }));

const node = (id: string, clusterId: string, url: string) => ({ id, clusterId, page: { url }, semanticSignalCount: 40 });
const graph = { clusters: [{ id: 'c0' }, { id: 'c1' }] };

it('builds nodes with cluster colours, fallback colour and saved positions', () => {
  const { nodes, links, topicLinks } = buildSimulationNodesAndLinks(
    [node('a', 'c1', 'u/a'), node('b', 'missing', 'u/b')],
    [{ id: 'e1', source: 'a', target: 'b', anchors: ['x'], links: 3 }],
    [{ id: 't1', source: 'b', target: 'a', sharedTerms: ['coffee'], weightedJaccard: 0.5 }],
    graph, { positions: { 'u/a': { x: 5, y: 6 } } });
  expect(nodes[0]).toMatchObject({ color: CLUSTER_COLORS[1], x: 5, y: 6 });
  expect(nodes[1]).toMatchObject({ color: '#94a3b8', x: undefined, y: undefined });
  expect(links[0]).toMatchObject({ kind: 'content-link', source: nodes[0], target: nodes[1], anchors: ['x'], links: 3 });
  expect(topicLinks[0]).toMatchObject({ kind: 'topic-similarity', source: nodes[1], target: nodes[0], sharedTerms: ['coffee'], weightedJaccard: 0.5, links: 0 });
});

it('wires link, charge, center and collision forces into the simulation', () => {
  const sim = forceSimulation<SimNode>([{ id: 'a', semanticNode: { semanticSignalCount: 100 } }, { id: 'b', semanticNode: { semanticSignalCount: 0 } }] as unknown as SimNode[]);
  const content = { id: 'l1', source: 'a', target: 'b', kind: 'content-link' };
  const topic = { id: 'l2', source: 'a', target: 'b', kind: 'topic-similarity' };
  applySimulationForces(sim, [content, topic] as never);
  const link = sim.force('link') as unknown as { distance: () => (l: unknown) => number; strength: () => (l: unknown) => number };
  expect([link.distance()(content), link.distance()(topic)]).toEqual([100, 145]);
  expect([link.strength()(content), link.strength()(topic)]).toEqual([0.45, 0.12]);
  expect(sim.force('charge')).toBeDefined();
  expect(sim.force('center')).toBeDefined();
  const radius = (sim.force('collision') as unknown as { radius: () => (n: unknown) => number }).radius();
  expect(radius({ semanticNode: { semanticSignalCount: 100 } })).toBe(24);
  expect(radius({ semanticNode: { semanticSignalCount: 20 } })).toBe(19);
  expect(sim.alphaDecay()).toBe(0.04);
});

const sim = { alphaTarget: vi.fn(), restart: vi.fn() };
const setup = () => { const setPrefs = vi.fn(); const call = vi.fn(); setupDragBehavior({ call }, { alphaTarget: sim.alphaTarget.mockReturnValue({ restart: sim.restart }) }, setPrefs); return setPrefs; };
beforeEach(() => { vi.clearAllMocks(); });

it('restarts the simulation only for the first drag and pins the node', () => {
  setup();
  const n = { x: 1, y: 2 } as SimNode;
  handlers.start({ active: 0 }, n);
  expect(sim.alphaTarget).toHaveBeenCalledWith(0.25);
  expect(sim.restart).toHaveBeenCalled();
  expect([n.fx, n.fy]).toEqual([1, 2]);
  handlers.start({ active: 1 }, n);
  expect(sim.alphaTarget).toHaveBeenCalledTimes(1);
  handlers.drag({ x: 9, y: 8 }, n);
  expect([n.fx, n.fy]).toEqual([9, 8]);
});

it('releases the node on end and stores a capped position map', () => {
  const setPrefs = setup();
  const n = { x: 3, y: 4, semanticNode: { page: { url: 'u/new' } } } as unknown as SimNode;
  handlers.end({ active: 0 }, n);
  expect(sim.alphaTarget).toHaveBeenCalledWith(0);
  expect([n.fx, n.fy]).toEqual([null, null]);
  const update = setPrefs.mock.calls[0][0] as (p: unknown) => { positions: Record<string, unknown>; keep: number };
  const old = Object.fromEntries(Array.from({ length: 160 }, (_, i) => [`u/${i}`, { x: i, y: i }]));
  const next = update({ positions: old, keep: 1 });
  expect(Object.keys(next.positions)).toHaveLength(160);
  expect(next.positions['u/0']).toBeUndefined();
  expect(next.positions['u/new']).toEqual({ x: 3, y: 4 });
  expect(next.keep).toBe(1);
});

it('keeps preferences untouched when the node has no coordinates or the drag is nested', () => {
  const setPrefs = setup();
  handlers.end({ active: 2 }, { semanticNode: { page: { url: 'u' } } });
  expect(sim.alphaTarget).not.toHaveBeenCalled();
  expect(setPrefs).not.toHaveBeenCalled();
});
