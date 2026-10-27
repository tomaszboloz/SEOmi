import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { initialModelState } from '@/stores/auth/models';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToolsStore } from '@/stores/toolsStore';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceIndicatorsStore } from '@/stores/workspaceIndicatorsStore';

describe('all store hooks and models direct call assertions', () => {
  it('initialModelState returns idle status and model maps', () => {
    const state = initialModelState();
    expect(state.modelListStatus.openai).toBe('idle');
    expect(state.availableModels).toBeDefined();
  });

  it('store factories expose observable state and working actions', () => {
    const snapshots = {
      audit: useAuditStore.getState(),
      auth: useAuthStore.getState(),
      project: useProjectStore.getState(),
      settings: useSettingsStore.getState(),
      tools: useToolsStore.getState(),
      ui: useUIStore.getState(),
      indicators: useWorkspaceIndicatorsStore.getState(),
    };
    const { result, unmount } = renderHook(() => useAuditStore());
    const auth = renderHook(() => useAuthStore());
    const project = renderHook(() => useProjectStore());
    const settings = renderHook(() => useSettingsStore());
    const tools = renderHook(() => useToolsStore());
    const ui = renderHook(() => useUIStore());
    const indicators = renderHook(() => useWorkspaceIndicatorsStore());
    try {
      act(() => { result.current.setActiveTab('metadata'); result.current.setSearchFilter('seo'); });
      expect(result.current.activeTab).toBe('metadata');
      expect(result.current.searchFilter).toBe('seo');
      act(() => { auth.result.current.setProvider('claude'); auth.result.current.setConnectionMethod('claude', 'local_cli'); });
      expect(auth.result.current.provider).toBe('claude');
      expect(auth.result.current.connectionMethod.claude).toBe('local_cli');
      let created: { id: string } | undefined;
      act(() => { created = project.result.current.createProject({ name: 'Factory contract', rootUrl: 'https://factory.test' }); });
      expect(created).toBeDefined();
      expect(project.result.current.activeProjectId).toBe(created?.id);
      act(() => { settings.result.current.setTheme('light'); tools.result.current.setKeywordQuery('factory'); tools.result.current.setDomainQuery('https://factory.test'); });
      expect(settings.result.current.theme).toBe('light');
      expect(tools.result.current.keywordQuery).toBe('factory');
      expect(tools.result.current.domainQuery).toBe('https://factory.test');
      act(() => { ui.result.current.openModal('settings'); ui.result.current.openCommandPalette(); ui.result.current.setSplitPaneRatio(60); });
      expect(ui.result.current.activeModal).toBe('settings');
      expect(ui.result.current.commandPaletteOpen).toBe(true);
      expect(ui.result.current.splitPaneRatio).toBe(60);
      act(() => indicators.result.current.setSnapshot({ savedKeywordsCount: 2, trackedRanksCount: 3, isCrawling: true, crawlProgress: 40, crawlRunsCount: 1 }));
      expect(indicators.result.current.crawlProgress).toBe(40);
    } finally {
      unmount(); auth.unmount(); project.unmount(); settings.unmount(); tools.unmount(); ui.unmount(); indicators.unmount();
      useAuditStore.setState(snapshots.audit, true); useAuthStore.setState(snapshots.auth, true);
      useProjectStore.setState(snapshots.project, true); useSettingsStore.setState(snapshots.settings, true);
      useToolsStore.setState(snapshots.tools, true); useUIStore.setState(snapshots.ui, true);
      useWorkspaceIndicatorsStore.setState(snapshots.indicators, true);
    }
  });
});
