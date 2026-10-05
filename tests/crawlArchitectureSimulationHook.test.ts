import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCrawlArchitectureSimulation } from '@/components/Charts/crawlArchitecture/useCrawlArchitectureSimulation';
import { WIDTH, HEIGHT } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';

const sim = vi.hoisted(() => ({ tick: null as null | (() => void), nodes: [] as Array<{ x?: number; y?: number }>, stop: vi.fn() }));
vi.mock('d3-force', async (orig) => ({
  ...(await orig<typeof import('d3-force')>()),
  forceSimulation: (nodes: Array<{ x?: number; y?: number }>) => {
    sim.nodes = nodes;
    const fake = { on: (_e: string, cb: () => void) => { sim.tick = cb; return fake; }, stop: sim.stop };
    return fake;
  },
}));
vi.mock('@/components/Charts/crawlArchitecture/CrawlArchitectureD3Helpers', async (orig) => ({
  ...(await orig<typeof import('@/components/Charts/crawlArchitecture/CrawlArchitectureD3Helpers')>()),
  applySimulationForces: vi.fn(),
  setupDragBehavior: vi.fn(),
}));

const node = (id: string, url: string, title: string, clusterId: string) => ({ id, page: { url, title }, clusterId, clusterLabel: `L-${id}`, semanticSignalCount: 5 });
const svgNs = 'http://www.w3.org/2000/svg';
const prefs = { positions: {}, transform: { x: 4, y: 5, k: 1 } };
let svg: SVGSVGElement;
let layer: SVGGElement;
let setPreferences: ReturnType<typeof vi.fn>;
let setSelectedId: ReturnType<typeof vi.fn>;

const mount = (over: Record<string, unknown> = {}) => renderHook(() => useCrawlArchitectureSimulation({
  svgRef: { current: svg }, graphLayerRef: { current: layer }, graph: { clusters: [{ id: 'c1' }] }, preferences: prefs,
  setPreferences, setSelectedId, selectedId: 'a', t: (key: string, o?: object) => `${key}${o ? JSON.stringify(o) : ''}`, markerId: 'mk',
  visibleNodes: [node('a', 'https://s.test/a', 'Page A', 'c1'), node('b', 'https://s.test/b?q=1', '', 'unknown')],
  visibleEdges: [{ id: 'a>b', source: 'a', target: 'b', anchors: [], links: 3 }],
  visibleTopicEdges: [{ id: 't', source: 'a', target: 'b', sharedTerms: ['x', 'y'], weightedJaccard: 0.5 }], ...over,
}));
const groups = () => [...layer.querySelectorAll<SVGGElement>('g.semantic-node')];

beforeEach(() => {
  svg = document.createElementNS(svgNs, 'svg');
  layer = document.createElementNS(svgNs, 'g');
  svg.appendChild(layer);
  document.body.appendChild(svg);
  setPreferences = vi.fn();
  setSelectedId = vi.fn();
  sim.stop.mockClear();
  sim.tick = null;
});

describe('useCrawlArchitectureSimulation rendering', () => {
  it('does nothing without an svg or layer', () => {
    renderHook(() => useCrawlArchitectureSimulation({ svgRef: { current: null }, graphLayerRef: { current: null }, graph: { clusters: [] }, preferences: prefs, visibleNodes: [], visibleEdges: [], visibleTopicEdges: [], t: String, markerId: 'm' } as never));
    expect(sim.tick).toBeNull();
    expect(layer.childElementCount).toBe(0);
  });

  it('draws nodes with accessible labels, colours and short URL text', () => {
    mount();
    const [a, b] = groups();
    expect(a.getAttribute('aria-label')).toContain('Page A');
    expect(b.getAttribute('aria-label')).toContain('/b?q=1');
    expect([a.getAttribute('aria-pressed'), b.getAttribute('aria-pressed')]).toEqual(['true', 'false']);
    expect(a.querySelector('circle')!.getAttribute('fill')).toBe('#34d399');
    expect(b.querySelector('circle')!.getAttribute('fill')).toBe('#94a3b8');
    expect(b.querySelector('text')!.textContent).toBe('/b?q=1');
    expect(layer.querySelector('line.semantic-edge')!.getAttribute('marker-end')).toBe('url(#mk)');
    expect(layer.querySelector('line.topic-similarity-edge')!.getAttribute('aria-label')).toContain('"percent":50');
  });

  it('selects a node on click and on Enter or Space but ignores other keys', () => {
    mount();
    const [a, b] = groups();
    a.dispatchEvent(new MouseEvent('click'));
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    a.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(setSelectedId.mock.calls).toEqual([['a'], ['b'], ['a']]);
  });

  it('stops the simulation when unmounted', () => {
    mount().unmount();
    expect(sim.stop).toHaveBeenCalledTimes(1);
  });
});

describe('useCrawlArchitectureSimulation ticks and zoom', () => {
  it('centres nodes that have no coordinates yet, then follows real ones', () => {
    mount();
    sim.tick!();
    expect(groups().map((g) => g.getAttribute('transform'))).toEqual([`translate(${WIDTH / 2},${HEIGHT / 2})`, `translate(${WIDTH / 2},${HEIGHT / 2})`]);
    expect(layer.querySelector('line.semantic-edge')!.getAttribute('x1')).toBe(String(WIDTH / 2));
    sim.nodes[0].x = 100; sim.nodes[0].y = 50; sim.nodes[1].x = 300; sim.nodes[1].y = 50;
    sim.tick!();
    expect(groups()[1].getAttribute('transform')).toBe('translate(300,50)');
    const edge = layer.querySelector('line.semantic-edge')!;
    expect([edge.getAttribute('x1'), edge.getAttribute('y1'), edge.getAttribute('y2')]).toEqual(['100', '50', '50']);
    // The arrow stops at the target node's radius instead of its centre.
    expect(Number(edge.getAttribute('x2'))).toBeLessThan(300);
    expect(Number(edge.getAttribute('x2'))).toBeGreaterThan(100);
  });

  it('applies the saved transform and keeps state when the persisted one is identical', () => {
    mount();
    expect(layer.getAttribute('transform')).toBe('translate(4,5) scale(1)');
    const updater = setPreferences.mock.calls[0][0] as (p: typeof prefs) => unknown;
    expect(updater(prefs)).toBe(prefs);
  });

  it('persists a transform that differs from the stored one', () => {
    mount({ preferences: { ...prefs, transform: { x: 0, y: 0, k: 2 } } });
    const updater = setPreferences.mock.calls[0][0] as (p: typeof prefs) => unknown;
    const same = { ...prefs, transform: { x: 0, y: 0, k: 2 } };
    expect(updater(same)).toBe(same);
    expect(updater(prefs)).toEqual({ ...prefs, transform: { x: 0, y: 0, k: 2 } });
  });
});
