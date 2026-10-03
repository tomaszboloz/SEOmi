import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuditStore } from '../src/stores/auditStore';

import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { notifyAuditCompleted, notifyBatchCompleted } from '@/services/desktopNotifications';
import { useSettingsStore } from '@/stores/settingsStore';

import { mockAudit } from "./fixtures/auditStoreContracts";
const dataForSeoMocks = vi.hoisted(() => ({
  getBacklinksSummary: vi.fn(),
  getSerpCompetitors: vi.fn(),
}));

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: vi.fn(() => false) }));

vi.mock('@/services/desktopNotifications', () => ({ notifyAuditCompleted: vi.fn(), notifyBatchCompleted: vi.fn() }));

vi.mock('@/services/dataforseo', async () => {
  const actual = await vi.importActual<typeof import('@/services/dataforseo')>('@/services/dataforseo');
  // Vitest 5 invokes this mock with `new`, so the implementation must be
  // constructible (an arrow function is not constructible).
  return {
    ...actual,
    DataForSEOClient: vi.fn().mockImplementation(function DataForSEOClientMock() {
      return dataForSeoMocks;
    }),
  };
});

describe('useAuditStore', () => {
beforeEach(() => {
    localStorage.clear();
    useAuditStore.getState().clearAudit();
    useAuditStore.setState({ history: [], isLoading: false, batchItems: [], batchRejectedRows: [], isBatchRunning: false, isBatchStopping: false });
    vi.mocked(invokeTauriCommand).mockReset();
    vi.mocked(isTauriEnvironment).mockReturnValue(false);
    vi.mocked(notifyAuditCompleted).mockReset();
    vi.mocked(notifyBatchCompleted).mockReset();
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
    dataForSeoMocks.getBacklinksSummary.mockReset();
    dataForSeoMocks.getSerpCompetitors.mockReset();
    vi.unstubAllGlobals();
  });

it('passes configured timeout, redirect limit and TLS verification to the native page audit', async () => {
    localStorage.setItem('seomi_active_project_v1', 'audit-options');
    const previous = useSettingsStore.getState().config;
    useSettingsStore.setState({ config: { ...previous, request_timeout_secs: 41, max_redirects: 2, verify_ssl: false } });
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    await useAuditStore.getState().startAudit(mockAudit.url);
    expect(invokeTauriCommand).toHaveBeenCalledWith('inspect_url', expect.objectContaining({ timeoutSecs: 41, maxRedirects: 2, verifySsl: false }));
    useSettingsStore.setState({ config: previous });
  });

it('passes all configured request options to every audit in an imported batch', async () => {
    localStorage.setItem('seomi_active_project_v1', 'batch-options');
    const previous = useSettingsStore.getState().config;
    useSettingsStore.setState({ config: { ...previous, request_timeout_secs: 29, max_redirects: 0, verify_ssl: false } });
    useAuditStore.getState().setSelectedUserAgent('custom-agent/2.0');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    try {
      useAuditStore.getState().importAuditCsv('url\nhttps://example.com/a\nhttps://example.com/b');
      await useAuditStore.getState().startBatchAudits();
      const calls = vi.mocked(invokeTauriCommand).mock.calls.filter(([command]) => command === 'inspect_url');
      expect(calls).toHaveLength(2);
      for (const [, args] of calls) expect(args).toMatchObject({ timeoutSecs: 29, maxRedirects: 0, verifySsl: false, userAgent: 'custom-agent/2.0', requestId: expect.any(String) });
    } finally { useSettingsStore.setState({ config: previous }); }
  });

it('keeps an explicit per-request user agent ahead of the selected default', async () => {
    localStorage.setItem('seomi_active_project_v1', 'explicit-agent');
    useAuditStore.getState().setSelectedUserAgent('googlebot_desktop');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    await useAuditStore.getState().startAudit(mockAudit.url, 'explicit-agent/1.0');
    expect(invokeTauriCommand).toHaveBeenCalledWith('inspect_url', expect.objectContaining({ userAgent: 'explicit-agent/1.0' }));
  });

it('starts without fabricated audit data', () => {
    const state = useAuditStore.getState();
    expect(state.currentAudit).toBeNull();
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
  });

it('should set audit data properly', () => {
    useAuditStore.getState().setAuditData(mockAudit);
    const state = useAuditStore.getState();
    expect(state.currentAudit).toEqual(mockAudit);
    expect(state.currentAudit?.health_score).toBe(95);
  });

it('should switch active tabs correctly including dataforseo', () => {
    const store = useAuditStore.getState();
    expect(store.activeTab).toBe('overview');

    store.setActiveTab('dataforseo');
    expect(useAuditStore.getState().activeTab).toBe('dataforseo');

    store.setActiveTab('security');
    expect(useAuditStore.getState().activeTab).toBe('security');

    store.setActiveTab('social');
    expect(useAuditStore.getState().activeTab).toBe('social');
  });

it('should update search filter', () => {
    useAuditStore.getState().setSearchFilter('canonical');
    expect(useAuditStore.getState().searchFilter).toBe('canonical');
  });

it('should update selected user agent preset', () => {
    useAuditStore.getState().setSelectedUserAgent('googlebot_desktop');
    expect(useAuditStore.getState().selectedUserAgent).toBe('googlebot_desktop');
  });

it('clears the selected audit without substituting a fabricated result', () => {
    useAuditStore.getState().setAuditData(mockAudit);
    expect(useAuditStore.getState().currentAudit?.url).toBe('https://example.com');

    useAuditStore.getState().clearAudit();
    expect(useAuditStore.getState().currentAudit).toBeNull();
  });

it('imports a project-local, deduplicated CSV queue without fabricating invalid URLs', () => {
    localStorage.setItem('seomi_active_project_v1', 'project-csv');
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com/a#fragment\nhttps://example.com/a\ninvalid-url');

    expect(useAuditStore.getState().batchItems).toMatchObject([
      { url: 'https://example.com/a', status: 'queued' },
    ]);
    expect(useAuditStore.getState().batchRejectedRows).toEqual(['invalid-url']);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-csv_audit_queue_v1') || '[]')).toHaveLength(1);
  });

it('persists the only-problems preference per project', () => {
    localStorage.setItem('seomi_active_project_v1', 'project-filter');
    useAuditStore.getState().setShowOnlyProblems(true);
    useAuditStore.getState().hydrateProject('project-filter');

    expect(useAuditStore.getState().showOnlyProblems).toBe(true);
    expect(localStorage.getItem('seomi_project_project-filter_audit_only_problems_v1')).toBe('true');
  });
});
