import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTopicalImports } from '@/components/Charts/semanticTopical/session/useTopicalImports';
import { useToolsStore } from '@/stores/toolsStore';

const m = vi.hoisted(() => ({ importCrawlClusters: vi.fn(), importTopicalQueries: vi.fn(), updateManualTopicalQueries: vi.fn() }));
vi.mock('@/services/topicalMap', () => m);

const t = ((key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key)) as never;
const doc = { nodes: [{ id: 'a' }] } as never;
const setup = (node: { id: string } | null = { id: 'n1' }) => {
  const props = { documentRef: { current: doc }, selectedNode: node, graph: {}, pages: [], runId: 'r', persist: vi.fn(), setSelectedId: vi.fn(), updateNode: vi.fn(), t } as never;
  return { props: props as Record<string, ReturnType<typeof vi.fn>>, view: renderHook(() => useTopicalImports(props)) };
};
const result = (over: object = {}) => ({ document: { changed: true }, addedCount: 2, updatedCount: 0, duplicateCount: 0, limitReached: false, ...over });
const gsc = (extra: object = {}) => ({ site_url: '', start_date: 's', end_date: 'e', queries: [{ query: 'q1', clicks: 1, impressions: 2, ctr: 0.5, position: 3 }], queries_may_be_truncated: false, max_rows_per_dimension: 100, ...extra });

describe('useTopicalImports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToolsStore.setState({ keywordResults: [], keywordResultsSource: null, gscData: null, gscDataFetchedAt: null, gscProperty: 'sc-domain:x' } as never);
  });

  it('imports clusters and selects the first new node', () => {
    m.importCrawlClusters.mockReturnValue({ nodes: [{ id: 'a' }, { id: 'new' }] });
    const { props, view } = setup();
    act(() => view.result.current.importClusters());
    expect(m.importCrawlClusters).toHaveBeenCalledWith(doc, {}, [], 'r');
    expect(props.persist).toHaveBeenCalledWith({ nodes: [{ id: 'a' }, { id: 'new' }] });
    expect(props.setSelectedId).toHaveBeenCalledWith('new');
  });

  it('persists without selecting when no node was added', () => {
    m.importCrawlClusters.mockReturnValue({ nodes: [{ id: 'a' }] });
    const { props, view } = setup();
    act(() => view.result.current.importClusters());
    expect(props.persist).toHaveBeenCalled();
    expect(props.setSelectedId).not.toHaveBeenCalled();
  });

  it('does nothing without a node or without source data', () => {
    const none = setup(null);
    act(() => none.view.result.current.importQueryEvidence('gsc'));
    expect(m.importTopicalQueries).not.toHaveBeenCalled();
    const empty = setup();
    act(() => empty.view.result.current.importQueryEvidence('dataforseo'));
    act(() => empty.view.result.current.importQueryEvidence('gsc'));
    expect(m.importTopicalQueries).not.toHaveBeenCalled();
    expect(empty.view.result.current.queryImportNotice).toBe('');
  });

  it('imports DataForSEO keywords with metric fallbacks', () => {
    useToolsStore.setState({ keywordResultsSource: { retrievedAt: 'now' }, keywordResults: [
      { keyword: 'full', sourceMetrics: { searchVolume: 10, cpc: 1.5, competitionIndex: 3, intent: 'info', monthlySearches: [1] } }, { keyword: 'bare' }] } as never);
    m.importTopicalQueries.mockReturnValue(result());
    const { props, view } = setup();
    act(() => view.result.current.importQueryEvidence('dataforseo'));
    const input = m.importTopicalQueries.mock.calls[0][2];
    expect(input[0].source).toMatchObject({ retrievedAt: 'now', searchVolume: 10, cpc: 1.5, competitionIndex: 3, searchIntent: 'info', monthlySearches: [1] });
    expect(input[1].source).toMatchObject({ searchVolume: null, cpc: null, competitionIndex: null, searchIntent: null, monthlySearches: [] });
    expect(props.persist).toHaveBeenCalledWith({ changed: true });
    expect(view.result.current.queryImportNotice).toBe(`semanticWorkspace.importAdded:${JSON.stringify({ count: 2, source: 'semanticWorkspace.sourceDataForSeo' })}`);
  });

  it('imports GSC rows, falls back to the property and reports notices', () => {
    useToolsStore.setState({ gscData: gsc({ queries_may_be_truncated: true }), gscDataFetchedAt: 'at' } as never);
    m.importTopicalQueries.mockReturnValue(result({ updatedCount: 1, duplicateCount: 3, limitReached: true }));
    const { view } = setup();
    act(() => view.result.current.importQueryEvidence('gsc'));
    expect(m.importTopicalQueries.mock.calls[0][2][0]).toEqual({ text: 'q1', source: expect.objectContaining({ provider: 'Google Search Console', propertyUrl: 'sc-domain:x', retrievedAt: 'at', clicks: 1, position: 3, queryRowsMayBeTruncated: true, maxRowsPerDimension: 100 }) });
    const notice = view.result.current.queryImportNotice;
    expect(notice).toContain('semanticWorkspace.sourceGsc');
    expect(notice).toContain('importUpdated:{"count":1}');
    expect(notice).toContain('importSkipped:{"count":2}');
    expect(notice).toContain('semanticWorkspace.importLimit');
    expect(notice).toContain('semanticWorkspace.importTruncated');
  });

  it('keeps the document when nothing changed and prefers the GSC site url', () => {
    useToolsStore.setState({ gscData: gsc({ site_url: 'https://site.test/' }), gscDataFetchedAt: 'at' } as never);
    m.importTopicalQueries.mockImplementation((d: unknown) => result({ document: d }));
    const { props, view } = setup();
    act(() => view.result.current.importQueryEvidence('gsc'));
    expect(m.importTopicalQueries.mock.calls[0][2][0].source.propertyUrl).toBe('https://site.test/');
    expect(props.persist).not.toHaveBeenCalled();
    expect(view.result.current.queryImportNotice).not.toContain('importTruncated');
  });

  it('updates manual queries and flags the limit', () => {
    m.updateManualTopicalQueries.mockReturnValueOnce({ queries: ['x'], limitReached: true }).mockReturnValueOnce({ queries: ['y'], limitReached: false });
    const { props, view } = setup();
    act(() => view.result.current.updateManualQueries('x'));
    expect(props.updateNode).toHaveBeenCalledWith('n1', { queries: ['x'] });
    expect(view.result.current.queryImportNotice).toBe('semanticWorkspace.manualQueryLimit');
    act(() => view.result.current.updateManualQueries('y'));
    expect(view.result.current.queryImportNotice).toBe('');
    const none = setup(null);
    act(() => none.view.result.current.updateManualQueries('z'));
    expect(none.props.updateNode).not.toHaveBeenCalled();
  });
});
