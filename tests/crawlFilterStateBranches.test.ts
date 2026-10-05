import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCrawlFilterState } from '@/components/Domain/crawlResults/session/useCrawlFilterState';
import { emptyCrawlNavigationPreferences, emptyCrawlLinkNavigationPreferences, filterPresetsKey } from '@/components/Domain/crawlResults/crawlResultsHelpers';
import type { SiteCrawlResult } from '@/types';

const page = (over: Record<string, unknown>) => ({ url: 'https://a.test/', final_url: 'https://a.test/f', title: 'A', issues: [], depth: 0, response_time_ms: 10, http_status: 200, content_type: 'text/html', ...over });
const pages = [
  page({ url: 'https://a.test/ok', title: 'Zeta', http_status: 200, depth: 2, response_time_ms: 50, issues: [{ severity: 'Info', message: 'm' }] }),
  page({ url: 'https://a.test/moved', title: 'Alpha', http_status: 301, depth: 1, response_time_ms: 5 }),
  page({ url: 'https://a.test/missing', title: undefined, http_status: 404, depth: 3, response_time_ms: 20, issues: [{ severity: 'Critical', message: 'm' }, { severity: 'Warning', message: 'm' }] }),
  page({ url: 'https://a.test/boom', http_status: 503, depth: 4, response_time_ms: 1 }),
  page({ url: 'https://a.test/dns', http_status: undefined, request_error_kind: 'DNS', depth: 5 }),
  page({ url: 'https://a.test/file.pdf', http_status: 200, content_type: 'application/pdf' }),
];
const result = { start_url: 'https://a.test/', pages, resources: [{ url: 'https://a.test/x.js', http_status: 500 }, { url: 'https://a.test/y.css', http_status: 200 }] } as unknown as SiteCrawlResult;
const setup = (project: string | null = 'p1') => renderHook(({ id }) => useCrawlFilterState(id, 'run', result, [], emptyCrawlNavigationPreferences(), emptyCrawlLinkNavigationPreferences()), { initialProps: { id: project } });
const urls = (h: ReturnType<typeof setup>) => h.result.current.pages.map((p: { url: string }) => p.url.replace('https://a.test/', ''));

describe('useCrawlFilterState', () => {
  beforeEach(() => localStorage.clear());

  it('filters pages by severity, segment, problems and text', () => {
    const h = setup();
    expect(urls(h)).toHaveLength(6);
    act(() => h.result.current.setSeverity('Critical'));
    expect(urls(h)).toEqual(['missing']);
    act(() => h.result.current.setSeverity('all'));
    for (const [seg, expected] of [['2xx', ['file.pdf', 'ok']], ['3xx', ['moved']], ['4xx', ['missing']], ['5xx', ['boom']], ['transport', ['dns']]] as const) {
      act(() => h.result.current.setSegment(seg));
      expect(urls(h).sort()).toEqual([...expected].sort());
    }
    act(() => h.result.current.setSegment('all'));
    act(() => h.result.current.setOnlyProblems(true));
    expect(urls(h).sort()).toEqual(['boom', 'dns', 'missing', 'ok']);
    act(() => h.result.current.setQuery('  ALPHA '));
    expect(urls(h)).toEqual([]);
    act(() => { h.result.current.setOnlyProblems(false); });
    expect(urls(h)).toEqual(['moved']);
  });

  it('sorts by every key and reverses when descending', () => {
    const h = setup();
    const order = (sort: string) => { act(() => h.result.current.setSort(sort as never)); return urls(h); };
    expect(order('url')[0]).toBe('boom');
    const byTitle = order('title'); expect(byTitle[0]).toBe('missing'); expect(byTitle[5]).toBe('ok');
    expect(order('status')[0]).toBe('dns');
    expect(order('depth')[0]).toBe('file.pdf');
    expect(order('responseTime')[0]).toBe('boom');
    expect(order('issues')[5]).toBe('missing');
    act(() => h.result.current.setDescending(true));
    expect(urls(h)[0]).toBe('missing');
  });

  it('derives error kinds, falls back for an unknown kind and filters resources', () => {
    const h = setup();
    expect(h.result.current.errorKinds).toEqual(expect.arrayContaining(['http', 'dns']));
    act(() => h.result.current.setErrorKind('dns'));
    expect(urls(h)).toEqual(['dns']);
    act(() => h.result.current.setErrorKind('bogus'));
    expect(h.result.current.activeErrorKind).toBe('all');
    act(() => h.result.current.setErrorKind('http'));
    expect(h.result.current.visibleResourceInventory.map((r: { resource: { url: string } }) => r.resource.url)).toEqual(['https://a.test/x.js']);
  });

  it('builds metadata rows only for html pages and counts facets', () => {
    const h = setup();
    expect(h.result.current.metadataRows).toHaveLength(5);
    expect(h.result.current.metadataFacetCounts.all).toBe(5);
    act(() => h.result.current.setMetadataFacet('missing-title'));
    expect(h.result.current.filteredMetadataRows.length).toBe(h.result.current.metadataFacetCounts['missing-title']);
    expect(h.result.current.filteredMetadataRows.length).toBeGreaterThan(0);
  });

  it('saves, applies and persists presets per project', () => {
    const h = setup();
    act(() => h.result.current.saveFilterPreset());
    expect(h.result.current.filterPresets).toEqual([]);
    act(() => { h.result.current.setNewPresetName('  Mine '); h.result.current.setSeverity('Warning'); h.result.current.setSegment('4xx'); h.result.current.setSort('depth'); h.result.current.setDescending(true); });
    act(() => h.result.current.saveFilterPreset());
    const saved = h.result.current.filterPresets[0];
    expect(saved).toMatchObject({ name: 'Mine', severity: 'Warning', segment: '4xx', sort: 'depth', descending: true });
    expect(h.result.current.newPresetName).toBe('');
    expect(h.result.current.selectedPresetId).toBe(saved.id);
    expect(JSON.parse(localStorage.getItem(filterPresetsKey('p1')) as string)[0].name).toBe('Mine');
    act(() => { h.result.current.setSeverity('all'); h.result.current.setSegment('all'); });
    act(() => h.result.current.applyFilterPreset(saved.id));
    expect(h.result.current.severity).toBe('Warning');
    expect(h.result.current.segment).toBe('4xx');
    act(() => h.result.current.applyFilterPreset('nope'));
    expect(h.result.current.selectedPresetId).toBe('nope');
    expect(h.result.current.severity).toBe('Warning');
    h.rerender({ id: 'p2' });
    expect(h.result.current.filterPresets).toEqual([]);
  });

  it('does not save or persist without an active project', () => {
    const h = setup(null);
    act(() => h.result.current.setNewPresetName('x'));
    act(() => h.result.current.saveFilterPreset());
    expect(h.result.current.filterPresets).toEqual([]);
    act(() => h.result.current.persistFilterPresets([]));
    expect(localStorage.length).toBe(0);
  });

  it('stores the compare-by-path flag per project', () => {
    const h = setup();
    act(() => h.result.current.updateCompareByPath(true));
    expect(localStorage.getItem('seomi_project_p1_crawl_compare_path_v1')).toBe('true');
    h.rerender({ id: 'p1' });
    expect(h.result.current.compareByPath).toBe(true);
    const none = setup(null);
    act(() => none.result.current.updateCompareByPath(true));
    expect(none.result.current.compareByPath).toBe(true);
    none.rerender({ id: null });
  });
});
