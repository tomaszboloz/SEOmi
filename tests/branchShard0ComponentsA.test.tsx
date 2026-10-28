import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { McpHub } from '@/components/AgentWorkflows/McpHub';
import { useSearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { AiBrandVisibility } from '@/components/AiVisibility/AiBrandVisibility';
import { AiCitationEvidenceItem } from '@/components/AiVisibility/searchPrompts/AiCitationEvidenceItem';
import { SubscriptionModal } from '@/components/Auth/SubscriptionModal';
import { CommandPalette } from '@/components/Layout/CommandPalette';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { useUIStore } from '@/stores/uiStore';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { saveGscSnapshot } from '@/services/gscPerformanceTracker';
import * as monitoring from '@/services/monitoringAlerts';
import type { GscPerformanceData } from '@/types';
import type { AiCitationEvidence } from '@/services/aiCitationEvidence';
import { createCrawlRunFixture } from './fixtures/crawl';

vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(),
  isTauriEnvironment: vi.fn(() => true),
  saveTextFile: vi.fn(),
}));

const originalTools = useToolsStore.getState();
const originalProjects = useProjectStore.getState();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    useToolsStore.setState(originalTools);
    useProjectStore.setState(originalProjects);
  });
});

describe('McpHub discovery guard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(invokeTauriCommand).mockReset();
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    useProjectStore.setState({ activeProjectId: 'shard0-mcp' });
  });

  it('does not call the native discovery command when the desktop runtime disappears before the click', () => {
    render(<McpHub />);
    const input = screen.getByRole('textbox', { name: i18n.t('mcp.serverPathAria') });
    fireEvent.change(input, { target: { value: '/srv/mcp/dist/index.js' } });
    const button = screen.getByRole('button', { name: i18n.t('mcp.discover') }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    vi.mocked(isTauriEnvironment).mockReturnValue(false);
    fireEvent.click(button);
    expect(invokeTauriCommand).not.toHaveBeenCalled();
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
  });
});

describe('useSearchConsoleSession', () => {
  const SITE = 'sc-domain:shard0.test';
  const data = (clicks: number): GscPerformanceData => ({
    site_url: SITE, start_date: '2026-09-01', end_date: '2026-09-28', total_clicks: clicks,
    total_impressions: 1000, avg_ctr: 0.01, avg_position: 8,
    queries: [{ query: 'seo', clicks, impressions: 500, ctr: 0.02, position: 9 }],
    pages: [{ page: 'https://shard0.test/', clicks, impressions: 500, ctr: 0.02, position: 9 }],
    daily: [{ date: '2026-09-01', clicks, impressions: 1000, ctr: 0.01, position: 8 }],
    queries_may_be_truncated: false, pages_may_be_truncated: false, daily_may_be_truncated: false,
    max_rows_per_dimension: 25000,
  });

  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({ activeProjectId: 'shard0-gsc' });
  });

  it('runs snapshot monitoring against the selected baseline when saving a snapshot', () => {
    saveGscSnapshot('shard0-gsc', data(5));
    const monitor = vi.spyOn(monitoring, 'monitorGscSnapshots').mockResolvedValue(undefined as never);
    act(() => { useToolsStore.setState({ gscHydratedProjectId: 'shard0-gsc', gscProperty: SITE, gscData: data(9) }); });
    const { result } = renderHook(() => useSearchConsoleSession());
    const baseline = result.current.baselineSnapshot;
    expect(baseline).not.toBeNull();
    act(() => { result.current.handleSaveSnapshot(); });
    expect(monitor).toHaveBeenCalledTimes(1);
    expect(monitor.mock.calls[0][0]).toBe('shard0-gsc');
    expect(monitor.mock.calls[0][1]).toBe(baseline);
    expect(monitor.mock.calls[0][2]).toMatchObject({ site_url: SITE, total_clicks: 9 });
    expect(result.current.snapshots.length).toBeGreaterThan(0);
  });
});

describe('AiBrandVisibility error banner', () => {
  it('shows the research error returned by the store', () => {
    localStorage.clear();
    act(() => {
      useProjectStore.setState({ projects: [], activeProjectId: 'shard0-brand' });
      useToolsStore.setState({ aiBrandError: 'Provider rejected the request', aiBrandReport: null, aiBrandHistory: [], isAiBrandLoading: false });
    });
    render(<AiBrandVisibility />);
    expect(screen.getByText('Provider rejected the request')).toBeTruthy();
  });
});

describe('AiCitationEvidenceItem label fallback', () => {
  it('renders an empty label when the matched page has no title or urls', () => {
    const evidence: AiCitationEvidence = {
      citation: 'https://example.com', normalizedUrl: 'https://example.com', matched: true, matchKind: 'final_url',
      page: { title: '', final_url: '', url: '', http_status: 200, indexability_status: 'indexable' },
    } as unknown as AiCitationEvidence;
    render(<AiCitationEvidenceItem cite={evidence.citation} cIdx={0} evidence={evidence} sourceContextRun={createCrawlRunFixture()} t={i18n.t} />);
    const expected = i18n.t('aiVisibility.search.matchDetail', { label: '', kind: 'final_url' }).trim();
    expect(screen.getByText((text) => text.trim() === expected)).toBeTruthy();
  });
});

describe('overlay mouse-down handling', () => {
  it('keeps the subscription modal open when the press starts inside the dialog', async () => {
    act(() => { useUIStore.setState({ activeModal: 'subscription' }); });
    await act(async () => { render(<SubscriptionModal />); });
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(useUIStore.getState().activeModal).toBe('subscription');
    act(() => { useUIStore.setState({ activeModal: null }); });
  });

  it('keeps the command palette open when the press starts inside the dialog', () => {
    act(() => { useUIStore.setState({ commandPaletteOpen: true, activeModal: null }); });
    render(<CommandPalette />);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    act(() => { useUIStore.setState({ commandPaletteOpen: false }); });
  });
});
