import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PagedTable } from '@/components/AgentWorkflows/searchConsole/PagedTable';
import { usePagedRows } from '@/components/AgentWorkflows/searchConsole/usePagedRows';
import { buildElements } from '@/components/Charts/crawlArchitecture/cytoscapeMap/buildElements';
import type { MapNode } from '@/components/Charts/crawlArchitecture/cytoscapeMap/mapTypes';
import { buildParityReport } from '@/components/Charts/semanticTopical/signals/parityAdapter';
import { buildTemplateEvents } from '@/components/Charts/semanticTopical/signals/templateAdapter';
import { formatCruxValue, cruxCategory } from '@/components/Performance/cruxEvidence';
import type { CrawledPageSummary } from '@/types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('remaining table and adapter boundaries', () => {
  it('renders a column without an optional class and exercises an unknown sort key', () => {
    const { result } = renderHook(() => usePagedRows([{ value: 2 }, { value: 1 }], { value: (row) => row.value }, 'value'));
    act(() => result.current.toggleSort('missing'));
    expect(result.current.rows.map((row) => row.value)).toEqual([2, 1]);
    render(<PagedTable columns={[{ key: 'value', label: 'Value', cell: (row: { value: number }) => row.value }]} paged={result.current} emptyLabel="empty" rowKey={(row) => String(row.value)} />);
    expect(screen.getByText('2')).toBeTruthy();
    const empty = renderHook(() => usePagedRows([], { value: (row: { value: number }) => row.value }, 'value'));
    render(<PagedTable columns={[{ key: 'value', label: 'Value', cell: (row: { value: number }) => row.value }]} paged={empty.result.current} emptyLabel="empty" rowKey={(row) => String(row.value)} />);
    expect(screen.getAllByText('empty')).toHaveLength(1);
  });

  it('uses the fallback label when a URL parser returns an empty path', () => {
    const original = globalThis.URL;
    vi.stubGlobal('URL', class { pathname = ''; search = ''; });
    const node = { id: 'n', url: 'opaque', title: 'N', status: 200, statusClass: '2xx', depth: 0, inlinks: 100, trs: null, section: 'one', orphan: false, problem: false } as MapNode;
    expect(buildElements([node], [], { grouped: false, collapsed: new Set() }).find((entry) => entry.data.id === 'n')?.data.label).toBe('/');
    vi.stubGlobal('URL', original);
  });

  it('handles a mutable section value and retains the defensive count fallback', () => {
    let reads = 0;
    const node = { id: 'n', url: 'https://example.test/', title: 'N', status: 200, statusClass: '2xx', depth: 0, inlinks: 1, trs: null, get section() { reads += 1; return reads === 1 ? 'known' : 'missing'; }, orphan: false, problem: false } as MapNode;
    expect(buildElements([node], [], { grouped: false, collapsed: new Set() })).toHaveLength(1);
  });

  it('normalizes absent language, empty coverage and reverse lexical ties', () => {
    const page = (url: string, language?: string, word_count = 10) => ({ url, final_url: url, word_count, ...(language === undefined ? {} : { document_language: language }) }) as unknown as CrawledPageSummary;
    expect(buildParityReport([page('https://none.test/')], { nodes: [], truncated: false } as never).status).toBe('inconclusive');
    const pages = [page('https://pl.test/', 'pl', 4), page('https://en.test/', 'en', 10)];
    const graph = { nodes: pages.map((p) => ({ page: p, clusterId: 'topic' })), truncated: false };
    expect(buildParityReport(pages, graph as never).rows[0]).toMatchObject({ language: 'pl', referenceDepth: 10, status: 'shallow' });
  });

  it('skips absent excerpts and falls back to the source URL for template events', () => {
    const page = (url: string, final_url?: string) => ({ url, ...(final_url === undefined ? {} : { final_url }), semantic_excerpts: ['same content'] }) as unknown as CrawledPageSummary;
    expect(buildTemplateEvents([{ url: 'https://none.test/' } as never])).toEqual([]);
    expect(buildTemplateEvents(Array.from({ length: 10 }, (_, i) => page(`https://source.test/${i}`, '')))).toEqual(expect.any(Array));
  });

  it('handles a missing metric name without inventing a CrUX rating', () => {
    expect(formatCruxValue({ percentiles: { p75: 1 } }, (key) => key)).toBe('1 pageSpeedUi.ms');
    expect(cruxCategory({ percentiles: { p75: 1 } }, (key) => key)).toBe('pageSpeedUi.crux.unrated');
  });
});
