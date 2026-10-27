import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SemanticPageNode } from '@/services/semanticMap';
import { toMapEdges, trsLookup, useMapModel } from '@/components/Charts/crawlArchitecture/cytoscapeMap/mapState';
import * as siteFocus from '@/services/siteFocus';
import { createCrawlPageFixture } from './fixtures/crawl';

const sem = (id: string, url: string, status = 200): SemanticPageNode => ({
  id, clusterId: 'c', clusterLabel: 'C', semanticSignalCount: 1, incomingContentLinks: 2, orphan: false,
  page: createCrawlPageFixture({ url, final_url: url, http_status: status }),
});
const visible = [sem('p0', 'https://a.test/blog/x'), sem('p1', 'https://a.test/blog/y', 404), sem('p2', 'https://a.test/shop/z')];
const edges = [{ id: 'e', source: 'p0', target: 'p1', anchors: ['a'], links: 3 }, { id: 'f', source: 'p1', target: 'p2', anchors: [], links: 1 }];

describe('trsLookup', () => {
  it('returns a url to TRS record for scored pages', () => {
    const pages = ['x', 'y', 'z'].map((n) => createCrawlPageFixture({ url: `https://a.test/${n}`, final_url: `https://a.test/${n}`, word_count: 400, title: `Coffee ${n}`, h1_count: 1 }));
    const lookup = trsLookup(pages, 'https://a.test/');
    Object.values(lookup).forEach((value) => expect(typeof value).toBe('number'));
  });

  it('falls back to an empty record when the report cannot be built', () => {
    const spy = vi.spyOn(siteFocus, 'buildSiteFocusReport').mockImplementation(() => { throw new Error('boom'); });
    expect(trsLookup([], 'https://a.test/')).toEqual({});
    spy.mockRestore();
  });

  it('skips pages the report marked as skipped', () => {
    const spy = vi.spyOn(siteFocus, 'buildSiteFocusReport').mockReturnValue({ pages: [{ url: 'u1', trs: 70, skipped: false }, { url: 'u2', trs: 10, skipped: true }] } as never);
    expect(trsLookup([], 'https://a.test/')).toEqual({ u1: 70 });
    spy.mockRestore();
  });

  it('keeps only the edge fields the map needs', () => {
    expect(toMapEdges(edges as never)[0]).toEqual({ id: 'e', source: 'p0', target: 'p1', links: 3 });
  });
});

describe('useMapModel', () => {
  const setup = () => renderHook(() => useMapModel([], 'https://a.test/', visible, edges as never));

  it('builds elements grouped by section for the force layout', () => {
    const { result } = setup();
    expect(result.current.layoutMode).toBe('force');
    expect(result.current.hasTrs).toBe(false);
    expect(result.current.elements.some((e) => e.data.id === 'sec:/blog')).toBe(true);
  });

  it('flattens the graph for the hierarchy layout', () => {
    const { result } = setup();
    act(() => result.current.setLayoutMode('hierarchy'));
    expect(result.current.elements.some((e) => e.data.id === 'sec:/blog')).toBe(false);
  });

  it('filters by status and highlights matches', () => {
    const { result } = setup();
    act(() => result.current.setFilters({ statuses: ['4xx'], maxDepth: null, problemsOnly: false }));
    expect(result.current.nodes.map((n) => n.id)).toEqual(['p1']);
    act(() => result.current.setHighlight('blog'));
    expect([...result.current.matches]).toEqual(['p1']);
  });

  it('collapses and expands sections individually and all at once', () => {
    const { result } = setup();
    act(() => result.current.toggleSection('/blog'));
    expect([...result.current.collapsed]).toEqual(['/blog']);
    act(() => result.current.toggleSection('/blog'));
    expect(result.current.collapsed.size).toBe(0);
    act(() => result.current.setAllCollapsed(true));
    expect([...result.current.collapsed]).toEqual(['/blog']);
    act(() => result.current.setAllCollapsed(false));
    expect(result.current.collapsed.size).toBe(0);
  });

  it('expands everything on a big site where sections start collapsed', () => {
    const many = Array.from({ length: 601 }, (_, i) => sem(`p${i}`, `https://a.test/s${i % 2}/${i}`));
    const { result } = renderHook(() => useMapModel([], 'https://a.test/', many, []));
    expect(result.current.collapsed.size).toBe(2);
    act(() => result.current.setAllCollapsed(false));
    expect(result.current.collapsed.size).toBe(0);
    act(() => result.current.setAllCollapsed(true));
    expect(result.current.collapsed.size).toBe(2);
  });
});
