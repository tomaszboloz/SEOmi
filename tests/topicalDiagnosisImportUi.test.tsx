import { act, renderHook } from '@testing-library/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTopicalImports } from '@/components/Charts/semanticTopical/session/useTopicalImports';
import { TopicalTopicBrowser } from '@/components/Charts/semanticTopical/TopicalTopicBrowser';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { createCrawlPageFixture } from './fixtures/crawl';
import { topicalSession } from './fixtures/topicalSessionContracts';

const page = (url: string, terms: string[], title: string) => createCrawlPageFixture({ url, final_url: url, semantic_language: 'pl', word_count: 800, hreflangs: [], title, semantic_terms: terms });
const pages = [
  page('https://ex.test/a/', ['navigator', 'alerty', 'crm'], 'Alerty Sales Navigatora'),
  page('https://ex.test/b/', ['navigator', 'alerty', 'teams'], 'Alerty Sales Navigatora w Teams'),
  page('https://ex.test/solo/', ['wordpress', 'kraków'], 'Samotna'),
];
const report = buildTopicalDiagnosis(pages, 'https://ex.test/');
const t = ((key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key)) as never;

describe('plan import from the diagnosis', () => {
  it('imports diagnosis topics instead of graph clusters when the report is present', () => {
    const persist = vi.fn();
    const setSelectedId = vi.fn();
    const documentRef = { current: createEmptyTopicalMap() };
    const { result } = renderHook(() => useTopicalImports({
      documentRef, selectedNode: null, graph: { clusters: [{ id: 'c1', label: 'Cluster', pageCount: 3 }] } as never, diagnosis: report, pages, runId: 'run-1', persist, setSelectedId, updateNode: vi.fn(), t,
    }));
    act(() => result.current.importClusters());
    const next = persist.mock.calls[0][0];
    expect(next.nodes).toHaveLength(1);
    expect(next.nodes[0]).toMatchObject({ sourceClusterId: report.topics[0].id, sourceUrls: ['https://ex.test/a/', 'https://ex.test/b/'] });
    expect(setSelectedId).toHaveBeenCalledWith(next.nodes[0].id);
  });

  it('labels the import button by the diagnosis topic count', () => {
    const session = topicalSession({ diagnosis: report, graph: { clusters: [] } } as never);
    render(<TopicalTopicBrowser session={session as never} />);
    const button = screen.getByRole('button', { name: 'topicalDiagnosis.import.button' });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('topicalDiagnosis.import.topicsCount:1')).toBeTruthy();
    fireEvent.click(button);
    expect(session.importClusters).toHaveBeenCalledTimes(1);
  });
});
