import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCytoscapeMap, type CytoscapeMapArgs } from '@/components/Charts/crawlArchitecture/cytoscapeMap/useCytoscapeMap';
import { fakeInstances, type FakeCy } from './fixtures/fakeCytoscape';

const make = (over: Partial<CytoscapeMapArgs> = {}): CytoscapeMapArgs => ({
  elements: [{ group: 'nodes', data: { id: 'a' } }, { group: 'nodes', data: { id: 'b' } }],
  layoutMode: 'force', matches: new Set(), selectedId: null,
  onSelect: vi.fn(), onToggleSection: vi.fn(), onHover: vi.fn(), ...over,
});
const target = (data: object, rendered = { x: 1, y: 2 }) => ({ target: { data: () => data, id: () => (data as { id: string }).id }, renderedPosition: rendered });
const cy = (): FakeCy => fakeInstances[fakeInstances.length - 1];

beforeEach(() => { fakeInstances.length = 0; });

describe('useCytoscapeMap', () => {
  it('creates one instance, loads elements and runs the layout', () => {
    renderHook(() => useCytoscapeMap(make()));
    expect(fakeInstances).toHaveLength(1);
    expect(cy().elementsAdded).toHaveLength(2);
    expect(cy().layoutCalls[0]).toMatchObject({ name: 'fcose' });
  });

  it('re-lays out with dagre when switching to hierarchy and destroys on unmount', () => {
    const { rerender, unmount } = renderHook((args: CytoscapeMapArgs) => useCytoscapeMap(args), { initialProps: make() });
    rerender(make({ layoutMode: 'hierarchy' }));
    expect(cy().layoutCalls.at(-1)).toMatchObject({ name: 'dagre' });
    unmount();
    expect(cy().destroyed).toBe(true);
  });

  it('routes taps: pages select, sections and groups toggle', () => {
    const args = make();
    renderHook(() => useCytoscapeMap(args));
    cy().emit('tap', target({ id: 'a', kind: 'page' }), 'node');
    cy().emit('tap', target({ id: 'sec:/blog', kind: 'section', section: '/blog' }), 'node');
    expect(args.onSelect).toHaveBeenCalledWith('a');
    expect(args.onToggleSection).toHaveBeenCalledWith('/blog');
  });

  it('reports hover position and clears it on mouseout', () => {
    const args = make();
    renderHook(() => useCytoscapeMap(args));
    cy().emit('mouseover', target({ id: 'a', kind: 'page' }, { x: 5, y: 6 }), 'node[kind = "page"]');
    cy().emit('mouseout', {}, 'node');
    expect(args.onHover).toHaveBeenNthCalledWith(1, { id: 'a', x: 5, y: 6 });
    expect(args.onHover).toHaveBeenNthCalledWith(2, null);
  });

  it('marks matches and dims the rest, then clears when the query is empty', () => {
    const { rerender } = renderHook((args: CytoscapeMapArgs) => useCytoscapeMap(args), { initialProps: make({ matches: new Set(['a']) }) });
    expect([...cy().classes.get('match')!]).toEqual(['a']);
    expect([...cy().classes.get('dim')!]).toEqual(['b']);
    rerender(make());
    expect(cy().classes.size).toBe(0);
  });

  it('selects the chosen element and unselects when cleared', () => {
    const { rerender } = renderHook((args: CytoscapeMapArgs) => useCytoscapeMap(args), { initialProps: make({ selectedId: 'b' }) });
    expect(cy().selected).toEqual(['b']);
    rerender(make({ selectedId: null }));
    expect(cy().selected).toEqual([]);
  });

  it('zooms around the centre and fits the view', () => {
    const { result } = renderHook(() => useCytoscapeMap(make()));
    act(() => result.current.zoomBy(2));
    expect(cy().zoomCalls[0]).toEqual({ level: 2, renderedPosition: { x: 400, y: 300 } });
    act(() => result.current.fit());
    expect(cy().fitCalls[0]).toEqual([undefined, 24]);
  });

  it('ignores zoom and fit after the instance is gone', () => {
    const { result, unmount } = renderHook(() => useCytoscapeMap(make()));
    unmount();
    expect(() => { result.current.zoomBy(2); result.current.fit(); }).not.toThrow();
    expect(cy().zoomCalls).toHaveLength(0);
  });
});
