import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSidebarNavigation } from '@/components/Layout/sidebar/useSidebarNavigation';
import { useAuditStore } from '@/stores/auditStore';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceIndicatorsStore } from '@/stores/workspaceIndicatorsStore';
import { createAuditFixture } from './fixtures/audit';
import { writeEphemeralStorage } from '@/services/storage';
import i18n from '@/i18n';

vi.mock('@/services/storage', async (load) => ({ ...await load<typeof import('@/services/storage')>(), writeEphemeralStorage: vi.fn() }));
const audit = useAuditStore.getState();
const ui = useUIStore.getState();
const indicators = useWorkspaceIndicatorsStore.getState();
const openModal = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  useAuditStore.setState({ currentAudit: null, activeTab: 'overview', isLoading: false, isBatchRunning: false });
  useWorkspaceIndicatorsStore.getState().reset();
  useUIStore.setState({ openModal });
});
afterEach(() => {
  useAuditStore.setState(audit);
  useUIStore.setState(ui);
  useWorkspaceIndicatorsStore.setState(indicators);
});

describe('sidebar navigation public state and actions', () => {
  it('prioritizes crawl, audit activity, measured score and retained run count', () => {
    const { result } = renderHook(() => useSidebarNavigation('', false));
    const badge = () => result.current.visibleNavSections.find(s => s.key === 'audit-workspace')!.badge!();
    expect(badge()).toBeNull();
    act(() => useWorkspaceIndicatorsStore.setState({ crawlRunsCount: 3 }));
    expect(badge()).toBe(3);
    act(() => useAuditStore.setState({ currentAudit: createAuditFixture({ health_score: 0 }) }));
    expect(badge()).toBe(0);
    act(() => useAuditStore.setState({ isBatchRunning: true }));
    expect(badge()).toBe(i18n.t('sidebar.running'));
    act(() => useAuditStore.setState({ isBatchRunning: false, isLoading: true }));
    expect(badge()).toBe(i18n.t('sidebar.running'));
    act(() => useWorkspaceIndicatorsStore.setState({ isCrawling: true, crawlProgress: 42.6 }));
    expect(badge()).toBe('43%');
  });
  it('keeps empty item counts unavailable and exposes positive counters and measured zero score', () => {
    const { result } = renderHook(() => useSidebarNavigation('', false));
    const badge = (id: string) => result.current.visibleNavSections.flatMap(s => s.items).find(i => i.id === id)!.badge!();
    expect(badge('overview')).toBeNull();
    expect(badge('saved-keywords')).toBeNull();
    expect(badge('rank-tracking')).toBeNull();
    act(() => {
      useAuditStore.setState({ currentAudit: createAuditFixture({ health_score: 0 }) });
      useWorkspaceIndicatorsStore.setState({ savedKeywordsCount: 4, trackedRanksCount: 2 });
    });
    expect(badge('overview')).toBe(0);
    expect(badge('saved-keywords')).toBe(4);
    expect(badge('rank-tracking')).toBe(2);
  });
  it('filters by section title or item vocabulary and ignores the query while collapsed', () => {
    const { result, rerender } = renderHook(({ query, collapsed }) => useSidebarNavigation(query, collapsed),
      { initialProps: { query: i18n.t('sidebar.keywordWorkflows'), collapsed: false } });
    expect(result.current.visibleNavSections.find(s => s.key === 'keyword-research')!.items).toHaveLength(4);
    rerender({ query: '  lighthouse  ', collapsed: false });
    expect(result.current.visibleNavSections).toHaveLength(1);
    expect(result.current.visibleNavSections[0].items[0].id).toBe('core-web-vitals');
    rerender({ query: 'nonexistent navigation term', collapsed: false });
    expect(result.current.visibleNavSections).toEqual([]);
    rerender({ query: 'nonexistent navigation term', collapsed: true });
    expect(result.current.visibleNavSections.length).toBeGreaterThan(1);
  });
  it('maps audit tabs and Google provider tabs to the correct sections', () => {
    const { result } = renderHook(() => useSidebarNavigation('', false));
    expect(result.current.activeSectionKey).toBe('audit-workspace');
    act(() => useAuditStore.setState({ activeTab: 'dataforseo' }));
    expect(result.current.activeSectionKey).toBe('google-data');
    act(() => useAuditStore.setState({ activeTab: 'keyword-research' }));
    expect(result.current.activeSectionKey).toBe('keyword-research');
  });
  it('opens each workspace tool through its public action', () => {
    const { result } = renderHook(() => useSidebarNavigation('', false));
    const section = result.current.visibleNavSections.find(s => s.key === 'workspace-tools')!;
    act(() => section.items.forEach(item => item.action!()));
    expect(openModal.mock.calls).toEqual([['ai'], ['subscription'], ['history'], ['settings']]);
  });
  it('activates the semantic map and dispatches its opening event', () => {
    const listener = vi.fn();
    window.addEventListener('seomi:open-crawl-map', listener);
    try {
      const { result } = renderHook(() => useSidebarNavigation('', false));
      const item = result.current.visibleNavSections.flatMap(s => s.items).find(i => i.labelKey === 'sidebar.semanticMap')!;
      act(() => item.action!());
      expect(writeEphemeralStorage).toHaveBeenCalledWith('seomi_open_crawl_map_v1', '1');
      expect(useAuditStore.getState().activeTab).toBe('site-audit');
      expect(listener).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('seomi:open-crawl-map', listener); }
  });
});
