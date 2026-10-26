import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchConsoleTables } from '@/components/AgentWorkflows/searchConsole/Tables';
import { McpServerConfigCard } from '@/components/AgentWorkflows/mcpHub/McpServerConfigCard';
import { DataForSeoCostMeter } from '@/components/DataForSEO/cost/DataForSeoCostMeter';
import { useHelp } from '@/components/Help/useHelp';
import { LinksWorkspace } from '@/components/Charts/semanticTopical/LinksWorkspace';
import { SemanticAuditPanel } from '@/components/Charts/SemanticAuditPanel';

const m = vi.hoisted(() => ({
  save: vi.fn(), tauri: vi.fn(() => false), cost: null as unknown, sfs: vi.fn(), tas: vi.fn(), scoreFns: [] as Array<(task: { module: string }) => number | null>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/services/tauri', () => ({ saveTextFile: m.save, isTauriEnvironment: m.tauri }));
vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
vi.mock('@/components/Charts/semanticTopical/OptimizationTaskTracker', () => ({ OptimizationTaskTracker: (props: { scoreFor: (task: { module: string }) => number | null }) => { m.scoreFns.push(props.scoreFor); return <div data-testid="tracker" />; } }));
vi.mock('@/components/Charts/OptimizationTaskTracker', () => ({ OptimizationTaskTracker: (props: { scoreFor: (task: { module: string }) => number | null }) => { m.scoreFns.push(props.scoreFor); return <div data-testid="tracker" />; } }));
vi.mock('@/components/Charts/InternalLinkOpportunitiesPanel', () => ({ InternalLinkOpportunitiesPanel: () => <div /> }));
vi.mock('@/components/Charts/DeploymentArtifactsPanel', () => ({ DeploymentArtifactsPanel: () => <div /> }));
vi.mock('@/services/siteFocus', () => ({ buildSiteFocusReport: m.sfs }));
vi.mock('@/services/topicalAuthority', () => ({ buildAuthorityReport: m.tas }));
vi.mock('@/services/recommendationBus/fromReports', () => ({ busInputFromReports: vi.fn(() => ({})) }));
vi.mock('@/services/recommendationBus', () => ({ runRecommendationBus: vi.fn(() => ({ quarantine: [], conflicts: [] })), excludeQuarantinedPages: (pages: unknown[]) => pages }));
vi.mock('@/services/deployArtifacts/fromBus', () => ({ rulesFromQuarantine: vi.fn(() => []) }));
vi.mock('@/services/semanticAudit', () => ({ buildSemanticAudit: vi.fn(() => ({ mappedTopics: 0, totalTopics: 0, mappedPages: 0, totalPages: 0, contentOrphanPages: 0, truncated: false, entityObservability: [], findings: [] })) }));
vi.mock('@/services/semanticRunComparison', () => ({ compareSemanticRuns: vi.fn() }));
vi.mock('@/services/crawlComparisonContract', () => ({ guardCrawlComparison: vi.fn() }));
vi.mock('@/services/monitoringAlerts', () => ({ monitorSemanticComparison: vi.fn() }));
vi.mock('@/stores/projectStore', () => ({ useProjectStore: (select: (state: { activeProjectId: string | null }) => unknown) => select({ activeProjectId: null }) }));
vi.mock('@/components/AgentWorkflows/searchConsole/PagedTable', () => ({ PagedTable: (props: { paged: { toggleSort: (key: string) => void } }) => <button type="button" onClick={() => props.paged.toggleSort('position')}>position</button> }));
vi.mock('@/components/DataForSEO/cost/useDataForSeoCost', () => ({ useDataForSeoCost: () => m.cost, formatUsd: (value: number) => `$${value}` }));

describe('remaining UI branch contracts', () => {
  it('sorts the hidden page position accessor through the table contract', () => {
    const session = { t: (key: string) => key, gscData: { queries: [], pages: [{ page: 'https://a.test', clicks: 1, impressions: 1, ctr: 1, position: 2 }] } };
    render(<SearchConsoleTables session={session as never} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'position' })[1]);
    expect(screen.getAllByRole('button', { name: 'position' })).toHaveLength(2);
  });

  it('enters the export guard for an absolute path with a non-JS extension', () => {
    render(<McpServerConfigCard mcpClientTab="claude" setMcpClientTab={vi.fn()} serverPath="/tmp/server.txt" updateServerPath={vi.fn()} discoverTools={vi.fn()} discovering={false} discoveryError="" />);
    const button = screen.getByRole('button', { name: 'mcp.exportConfig' });
    button.removeAttribute('disabled');
    const propsKey = Object.keys(button).find((key) => key.startsWith('__reactProps$'));
    (Reflect.get(button, propsKey!) as { onClick: () => void }).onClick();
    expect(m.save).not.toHaveBeenCalled();
  });

  it('renders the month-with-limit branch of the cost meter', () => {
    m.cost = { projectId: 'p', spend: { totalUsd: 3, calls: 1, lastCall: null }, budget: { monthlyLimitUsd: 10 }, status: { level: 'none', percent: undefined }, account: null };
    render(<DataForSeoCostMeter />);
    expect(screen.getByRole('status').textContent).toContain('dataforseoCost.monthWithLimit');
  });

  it('returns null for an incomplete help entry', () => {
    const hook = renderHook(() => useHelp('missing' as never));
    expect(hook.result.current).toBeNull();
  });

  it('returns null scores for unavailable or incomplete reports', () => {
    m.sfs.mockReturnValue({ unavailable: true, score: 90 });
    m.tas.mockReturnValue({});
    render(<LinksWorkspace projectId="p" pages={[{ url: 'https://site.test/' }] as never} />);
    const score = m.scoreFns.at(-1)!;
    expect(score({ module: 'sfs' })).toBeNull();
    expect(score({ module: 'tas' })).toBeNull();
  });

  it('renders the no-baseline comparison state without invoking a comparison', () => {
    render(<SemanticAuditPanel document={{} as never} pages={[]} />);
    expect(screen.getByText('semanticAudit.noBaseline')).toBeTruthy();
  });
});
