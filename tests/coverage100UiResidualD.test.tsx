import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SemanticAuditPanel } from '@/components/Charts/SemanticAuditPanel';
import { BriefVersionHistory } from '@/components/Charts/contentBrief/BriefVersionHistory';
import { LinksWorkspace } from '@/components/Charts/semanticTopical/LinksWorkspace';
import { SemanticWorkspacePanels } from '@/components/Charts/semanticTopical/SemanticWorkspacePanels';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const m = vi.hoisted(() => ({
  build: vi.fn(), compare: vi.fn(), guard: vi.fn(), monitor: vi.fn(), focus: vi.fn(), authority: vi.fn(), busInput: vi.fn(), bus: vi.fn(), rules: vi.fn(), takePending: vi.fn(), scoreFns: [] as Array<(task: { module: string }) => number | null>,
}));
vi.mock('react-i18next', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-i18next')>()), useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/stores/projectStore', () => ({ useProjectStore: (select: (state: { activeProjectId: string }) => unknown) => select({ activeProjectId: 'project' }) }));
vi.mock('@/services/semanticAudit', () => ({ buildSemanticAudit: m.build }));
vi.mock('@/services/semanticRunComparison', () => ({ compareSemanticRuns: m.compare }));
vi.mock('@/services/crawlComparisonContract', () => ({ guardCrawlComparison: m.guard }));
vi.mock('@/services/monitoringAlerts', () => ({ monitorSemanticComparison: m.monitor }));
vi.mock('@/services/contentBrief', () => ({ compareDrafts: () => ({ changed: false, addedLineCount: 0, removedLineCount: 0, addedCharacterCount: 0, removedCharacterCount: 0, addedLines: [], removedLines: [] }), saveDraftVersion: (brief: unknown) => brief }));
vi.mock('@/services/siteFocus', () => ({ buildSiteFocusReport: m.focus }));
vi.mock('@/services/topicalAuthority', () => ({ buildAuthorityReport: m.authority }));
vi.mock('@/services/recommendationBus/fromReports', () => ({ busInputFromReports: m.busInput, removalCandidates: () => [], REMOVE_TRS_BELOW: 40 }));
vi.mock('@/services/recommendationBus', () => ({ runRecommendationBus: m.bus, excludeQuarantinedPages: (pages: unknown[]) => pages }));
vi.mock('@/services/deployArtifacts/fromBus', () => ({ rulesFromQuarantine: m.rules }));
vi.mock('@/services/executionCard/openBrief', () => ({ takePendingBrief: m.takePending }));
vi.mock('@/components/Charts/InternalLinkOpportunitiesPanel', () => ({ InternalLinkOpportunitiesPanel: () => <div /> }));
vi.mock('@/components/Charts/DeploymentArtifactsPanel', () => ({ DeploymentArtifactsPanel: () => <div /> }));
vi.mock('@/components/Projects/ProjectSwitcher', () => ({ ProjectSwitcher: () => <div /> }));
vi.mock('@/components/Charts/semanticTopical/TopicalTopicBrowser', () => ({ TopicalTopicBrowser: () => <div data-testid="topics" /> }));
vi.mock('@/components/Charts/semanticTopical/TopicalNodeEditor', () => ({ TopicalNodeEditor: () => <div data-testid="editor" /> }));
vi.mock('@/components/Charts/TopicalCalendar', () => ({ TopicalCalendar: () => <div data-testid="calendar" /> }));
vi.mock('@/components/Charts/semanticTopical/signals/SignalsWorkspace', () => ({ SignalsWorkspace: () => <div data-testid="signals" /> }));
vi.mock('@/components/Charts/SchemaGraphBuilder', () => ({ SchemaGraphBuilder: () => <div /> }));
vi.mock('@/components/Charts/EntityEvidenceGraph', () => ({ EntityEvidenceGraph: () => <div /> }));
vi.mock('@/components/Charts/OptimizationTaskTracker', () => ({ OptimizationTaskTracker: (props: { scoreFor: (task: { module: string }) => number | null }) => { m.scoreFns.push(props.scoreFor); return <div data-testid="tracker" />; } }));

const report = { mappedTopics: 0, totalTopics: 0, mappedPages: 0, totalPages: 0, contentOrphanPages: 0, truncated: false, entityObservability: [], findings: [] };
const comparison = { baselineRunId: 'base', currentRunId: 'current', truncated: false, counts: Object.fromEntries(['url-added', 'url-not-observed', 'content-terms-changed', 'content-link-added', 'content-link-not-observed', 'topic-edge-added', 'topic-edge-not-observed', 'topic-url-coverage-changed', 'query-term-observation-changed'].map((key) => [key, 0])), changes: [] };

beforeEach(() => {
  m.build.mockReturnValue(report); m.compare.mockReturnValue(comparison); m.guard.mockReturnValue(null); m.monitor.mockReset(); m.takePending.mockReturnValue(null); m.focus.mockReturnValue({ unavailable: false, score: 88 }); m.authority.mockReturnValue({ tas: 77 }); m.busInput.mockReturnValue({}); m.bus.mockReturnValue({ quarantine: [], conflicts: [] }); m.rules.mockReturnValue([]); m.scoreFns.length = 0;
});

describe('semantic audit and brief edge paths', () => {
  it('monitors a comparable project audit', () => {
    const run = { id: 'base', completedAt: '2026-10-01', result: { pages_crawled: 0, pages: [] } };
    const current = { id: 'current', completedAt: '2026-10-02', result: { pages_crawled: 0, pages: [] } };
    render(<SemanticAuditPanel document={{} as never} pages={[]} runs={[run, current] as never} currentRunId="current" />);
    expect(m.monitor).toHaveBeenCalledWith('project', comparison);
  });

  it('keeps a same-content restore as a no-op', () => {
    const onUpdate = vi.fn();
    render(<BriefVersionHistory model={{ brief: { draftMarkdown: 'same', draftVersions: [{ id: 'v1', draftMarkdown: 'same', note: '', savedAt: '2026-10-01' }] }, onUpdate } as never} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'v1' } });
    const button = screen.getByRole('button', { name: 'contentBrief.restoreVersion' });
    button.removeAttribute('disabled');
    const key = Object.keys(button).find((name) => name.startsWith('__reactProps$'));
    (Reflect.get(button, key!) as { onClick: () => void }).onClick();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('semantic links and workspace fallbacks', () => {
  it('exposes score fallbacks for every optimization module and tolerates report errors', () => {
    const page = createCrawlPageFixture({ url: 'https://site.test/', final_url: 'https://site.test/', http_status: 200 });
    const pages = [page];
    const run = createCrawlRunFixture({ id: 'current-run', result: createCrawlResultFixture({ pages }) });
    render(<LinksWorkspace projectId="project" pages={pages} run={run} />);
    const score = m.scoreFns[0];
    expect(score({ module: 'sfs' })).toBe(88);
    expect(score({ module: 'tas' })).toBe(77);
    expect(score({ module: 'other' })).toBeNull();
    m.focus.mockImplementationOnce(() => { throw new Error('incomplete'); });
    render(<LinksWorkspace projectId={null} pages={pages} run={run} />);
    expect(m.focus).toHaveBeenCalledTimes(2);
  });

  it('consumes a pending brief and routes the signals view', () => {
    m.takePending.mockReturnValueOnce('pending-id');
    const sessionData = { addNodeOnDate: vi.fn(), currentRunId: '', document: { nodes: [] }, pages: [], runs: [], selectedNode: null, setSelectedId: vi.fn(), t: (key: string) => key, updateWorkspacePreferences: vi.fn(), projectId: 'project', graph: {}, workspacePreferences: { view: 'topics', month: '', filters: { lifecycle: 'all', kind: 'all', boundary: 'all' }, search: '', schemaUrl: '', includeSchemaOrganization: false, includeSchemaBreadcrumbs: false, schemaArticleType: '' } };
    const view = render(<SemanticWorkspacePanels session={sessionData as never} />);
    expect(sessionData.setSelectedId).toHaveBeenCalledWith('pending-id');
    expect(sessionData.updateWorkspacePreferences).toHaveBeenCalledWith({ view: 'topics' });
    view.rerender(<SemanticWorkspacePanels session={{ ...sessionData, workspacePreferences: { ...sessionData.workspacePreferences, view: 'signals' } } as never} />);
    expect(screen.getByTestId('signals')).toBeTruthy();
  });
});
