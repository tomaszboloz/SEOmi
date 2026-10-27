import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlArchitectureControls } from '@/components/Charts/crawlArchitecture/CrawlArchitectureControls';
import { CrawlArchitectureMainContent } from '@/components/Charts/crawlArchitecture/CrawlArchitectureMainContent';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({ t: (k: string, opt?: any) => opt?.label ? `${k}:${opt.label}` : k }),
  };
});
vi.mock('@/components/Charts/crawlArchitecture/topicalDiagnosis/TopicalDiagnosisView', () => ({
  TopicalDiagnosisView: () => <div data-testid="diagnosis-view">Diagnosis</div>,
}));
vi.mock('@/components/Charts/SemanticTopicalWorkspace', () => ({
  SemanticTopicalWorkspace: () => <div data-testid="plan-view">Plan</div>,
}));
vi.mock('@/components/Charts/CrawlDirectoryTree', () => ({
  CrawlDirectoryTree: () => <div data-testid="directory-view">Directory</div>,
}));
vi.mock('@/components/Charts/crawlArchitecture/CrawlArchitectureGraphView', () => ({
  CrawlArchitectureGraphView: () => <div data-testid="graph-view">Graph</div>,
}));

describe('CrawlArchitectureControls & MainContent branches', () => {
  it('exercises all controls: search, filters, zoom buttons, linkMode and clearDiagnosis', async () => {
    let prefs: any = { query: '', clusterFilter: 'all', orphansOnly: false, linkMode: 'content', diagnosisFilter: { kind: 'topic', id: 't1' } };
    const setPreferences = vi.fn((updater) => { prefs = typeof updater === 'function' ? updater(prefs) : updater; });
    const scaleView = vi.fn();
    const resetView = vi.fn();
    const diagnosis: any = { topics: [{ id: 't1', label: 'SEO Topic', documentIds: ['d1'] }], areas: [] };
    const graph: any = { clusters: [{ id: 'c1', label: 'Cluster 1', pageCount: 3 }] };

    const { rerender } = render(
      <CrawlArchitectureControls preferences={prefs} setPreferences={setPreferences} graph={graph} scaleView={scaleView} resetView={resetView} diagnosis={diagnosis} />
    );

    const clearBtn = screen.getByLabelText('mapUi.clearDiagnosisFilter');
    await act(async () => { fireEvent.click(clearBtn); });
    expect(setPreferences).toHaveBeenCalled();

    const searchInput = screen.getByLabelText('mapUi.searchAria');
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'test' } }); });

    const allLinksBtn = screen.getByText('mapUi.allLinks');
    await act(async () => { fireEvent.click(allLinksBtn); });

    const zoomInBtn = screen.getByLabelText('mapUi.zoomIn');
    const zoomOutBtn = screen.getByLabelText('mapUi.zoomOut');
    const resetBtn = screen.getByLabelText('mapUi.resetZoom');
    await act(async () => {
      fireEvent.click(zoomInBtn);
      fireEvent.click(zoomOutBtn);
      fireEvent.click(resetBtn);
    });
    expect(scaleView).toHaveBeenCalledWith(1.2);
    expect(scaleView).toHaveBeenCalledWith(1 / 1.2);
    expect(resetView).toHaveBeenCalled();

    rerender(<CrawlArchitectureControls preferences={{ ...prefs, diagnosisFilter: null }} setPreferences={setPreferences} graph={graph} scaleView={scaleView} resetView={resetView} diagnosis={undefined} />);
    const clusterSelect = screen.getByLabelText('mapUi.clusterAria');
    await act(async () => { fireEvent.change(clusterSelect, { target: { value: 'c1' } }); });
  });

  it('switches views in CrawlArchitectureMainContent based on activeView', () => {
    const baseState: any = {
      activeProjectId: 'p1', effectiveRunId: 'r1', activeView: 'graph',
      graph: { nodes: [{ id: 'n1', page: { url: 'https://ex.com' }, orphan: false }], edges: [], topicEdges: [], totalEdges: 0, totalTopicEdges: 0, totalInternalLinks: 0, hasSemanticTerms: true, truncated: false },
      contentGraph: { nodes: [], edges: [] }, visibleNodes: [], visibleEdges: [], visibleTopicEdges: [], preferences: { linkMode: 'all' },
      setSelectedId: vi.fn(), setPreferences: vi.fn(), setActiveView: vi.fn(), diagnosis: { areas: [], topics: [] }
    };
    const { rerender } = render(<CrawlArchitectureMainContent pages={[]} crawlMode="http" sitemapUrls={[]} runs={[]} currentRunId="r1" state={baseState} />);
    expect(screen.getByTestId('graph-view')).toBeTruthy();

    rerender(<CrawlArchitectureMainContent pages={[]} crawlMode="http" sitemapUrls={[]} runs={[]} currentRunId="r1" state={{ ...baseState, activeView: 'diagnosis' }} />);
    expect(screen.getByTestId('diagnosis-view')).toBeTruthy();

    rerender(<CrawlArchitectureMainContent pages={[]} crawlMode="http" sitemapUrls={[]} runs={[]} currentRunId="r1" state={{ ...baseState, activeView: 'plan' }} />);
    expect(screen.getByTestId('plan-view')).toBeTruthy();

    rerender(<CrawlArchitectureMainContent pages={[]} crawlMode="http" sitemapUrls={[]} runs={[]} currentRunId="r1" state={{ ...baseState, activeView: 'directory' }} />);
    expect(screen.getByTestId('directory-view')).toBeTruthy();
  });
});
