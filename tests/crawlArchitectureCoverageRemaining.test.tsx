import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlArchitectureMainContent } from '@/components/Charts/crawlArchitecture/CrawlArchitectureMainContent';
import { GraphEvidencePanel } from '@/components/Charts/crawlArchitecture/GraphEvidencePanel';
import { buildTrafficEvidence } from '@/services/semanticGraph/trafficEvidence';

const evidenceState = vi.hoisted(() => ({
  project: { activeProjectId: 'coverage-project' },
  tools: { gscProperty: 'sc-domain:example.com', gscFilters: {}, gscData: null as unknown },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key }),
}));
vi.mock('@/components/Charts/SemanticTopicalWorkspace', () => ({ SemanticTopicalWorkspace: () => <div data-testid="plan-view" /> }));
vi.mock('@/components/Charts/CrawlDirectoryTree', () => ({ CrawlDirectoryTree: () => <div data-testid="directory-view" /> }));
vi.mock('@/components/Charts/crawlArchitecture/CrawlArchitectureGraphView', () => ({ CrawlArchitectureGraphView: () => <div data-testid="graph-view" /> }));
vi.mock('@/components/Charts/crawlArchitecture/topicalDiagnosis/TopicalDiagnosisView', () => ({
  TopicalDiagnosisView: ({ onOpenPage }: { onOpenPage: (url: string) => void }) => (
    <div>
      <button data-testid="open-final" onClick={() => onOpenPage('https://known.test/final')}>final</button>
      <button data-testid="open-missing" onClick={() => onOpenPage('https://missing.test')}>missing</button>
    </div>
  ),
}));
vi.mock('@/stores/projectStore', () => ({ useProjectStore: (selector: (state: typeof evidenceState.project) => unknown) => selector(evidenceState.project) }));
vi.mock('@/stores/toolsStore', () => ({ useToolsStore: (selector: (state: typeof evidenceState.tools) => unknown) => selector(evidenceState.tools) }));
vi.mock('@/services/semanticGraph/trafficEvidence', () => ({ buildTrafficEvidence: vi.fn() }));

const page = { url: 'https://known.test/original', final_url: 'https://known.test/final' };
const graph = (overrides: Record<string, unknown> = {}) => ({
  nodes: [{ id: 'known-node', page, orphan: false }],
  edges: [], totalEdges: 0, topicEdges: [], totalTopicEdges: 0, totalInternalLinks: 0,
  hasSemanticTerms: true, truncated: false, ...overrides,
});
const state = (overrides: Record<string, unknown> = {}) => ({
  activeProjectId: 'coverage-project', effectiveRunId: 'coverage-run', activeView: 'graph', graph: graph(),
  contentGraph: graph(), visibleNodes: [], visibleEdges: [], visibleTopicEdges: [], preferences: { linkMode: 'content' },
  diagnosis: { areas: [], topics: [] }, setPreferences: vi.fn(), setSelectedId: vi.fn(), setActiveView: vi.fn(), setDiagnosisFilter: vi.fn(), ...overrides,
});
const props = { pages: [{ semantic_content_source: 'primary-root' }, { semantic_content_source: 'body-fallback' }, {}], crawlMode: 'http', sitemapUrls: [], runs: [], currentRunId: undefined };

describe('crawl architecture remaining coverage', () => {
  beforeEach(() => {
    evidenceState.tools.gscData = null;
    evidenceState.tools.gscFilters = {};
    vi.mocked(buildTrafficEvidence).mockReset();
  });
  afterEach(() => cleanup());

  it('opens a final-url diagnosis page and clears every graph restriction', () => {
    const current = state({ activeView: 'diagnosis' });
    render(<CrawlArchitectureMainContent {...props} state={current} />);
    fireEvent.click(screen.getByTestId('open-final'));
    expect(current.setSelectedId).toHaveBeenCalledWith('known-node');
    expect(current.setActiveView).toHaveBeenCalledWith('graph');
    const update = current.setPreferences.mock.calls[0][0] as (value: Record<string, unknown>) => Record<string, unknown>;
    expect(update({ diagnosisFilter: { kind: 'topic', id: 'old' }, clusterFilter: 'c', orphansOnly: true, query: 'old' })).toMatchObject({ diagnosisFilter: null, clusterFilter: 'all', orphansOnly: false, query: '' });
    fireEvent.click(screen.getByTestId('open-missing'));
    expect(current.setSelectedId).toHaveBeenCalledTimes(1);
  });

  it('renders the content graph metrics when totals are already complete', () => {
    const node = { id: 'one', page: { url: 'https://one.test' }, orphan: false };
    const edges = Array.from({ length: 2 }, () => ({ source: 'one', target: 'one' }));
    const current = state({
      graph: graph({ nodes: [node], edges, totalEdges: 2, topicEdges: edges, totalTopicEdges: 2, totalInternalLinks: 2 }),
      visibleNodes: [node], visibleEdges: edges, visibleTopicEdges: edges,
    });
    render(<CrawlArchitectureMainContent {...props} state={current} />);
    expect(screen.getByText('mapUi.graph.contentTitle')).toBeTruthy();
    expect(screen.getByTestId('graph-view')).toBeTruthy();
    expect(screen.queryByText('mapUi.truncated')).toBeNull();
  });

  it('shows no-node evidence for malformed graph and GSC shapes', () => {
    evidenceState.tools.gscData = [];
    render(<GraphEvidencePanel graph={{ nodes: 'bad', edges: 'bad', truncated: false } as never} />);
    expect(screen.getByText('sprsUi.empty')).toBeTruthy();
    expect(screen.getByText('mapUi.graphEvidence.status.unavailable')).toBeTruthy();
  });

  it('renders nullable metrics and non-empty traffic filters without inventing values', () => {
    const traffic = {
      status: 'complete', projectId: 'coverage-project', property: { key: 'sc-domain:example.com' },
      dateRange: { startDate: '2026-09-01', endDate: '2026-09-30' }, filters: { device: 'MOBILE', country: 'pl' },
      nodes: [{ nodeId: 'one', urls: ['https://one.test'], metrics: { clicks: null, impressions: null, ctr: null, position: null }, observed: true, observation: 'gsc' }],
      matchedNodeIds: ['one'], missingNodeIds: [], uncertainNodeIds: [], outOfScopeNodeIds: [], ambiguousNodeIds: [], ignoredRows: 0, invalidRows: 0, truncated: false, errors: [],
    } as never;
    vi.mocked(buildTrafficEvidence).mockReturnValue(traffic);
    evidenceState.tools.gscData = { site_url: 'sc-domain:example.com', start_date: '2026-09-01', end_date: '2026-09-30', pages: [] };
    render(<GraphEvidencePanel graph={graph({ nodes: [{ id: 'one', page: { url: 'https://one.test' }, orphan: false }] }) as never} />);
    expect(screen.getByText('mapUi.graphEvidence.status.complete')).toBeTruthy();
    expect(screen.getByText(/MOBILE · PL/)).toBeTruthy();
    expect(screen.getByText('— / —')).toBeTruthy();
  });
});
