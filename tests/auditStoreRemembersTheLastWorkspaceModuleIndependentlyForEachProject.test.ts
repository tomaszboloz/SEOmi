import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuditStore } from '../src/stores/auditStore';

import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { notifyAuditCompleted, notifyBatchCompleted } from '@/services/desktopNotifications';
import { useSettingsStore } from '@/stores/settingsStore';
import i18n from '@/i18n';
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

it('remembers the last workspace module independently for each project', () => {
    localStorage.setItem('seomi_active_project_v1', 'project-navigation-a');
    useAuditStore.getState().hydrateProject('project-navigation-a');
    useAuditStore.getState().setActiveTab('keyword-clustering');

    localStorage.setItem('seomi_active_project_v1', 'project-navigation-b');
    useAuditStore.getState().hydrateProject('project-navigation-b');
    expect(useAuditStore.getState().activeTab).toBe('overview');

    localStorage.setItem('seomi_active_project_v1', 'project-navigation-a');
    useAuditStore.getState().hydrateProject('project-navigation-a');
    expect(useAuditStore.getState().activeTab).toBe('keyword-clustering');
  });

it('uses the original project history to detect score regressions', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-regression');
    localStorage.setItem('seomi_project_project-regression_audit_history', JSON.stringify([{ ...mockAudit, health_score: 98 }]));
    useAuditStore.getState().hydrateProject('project-regression');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);

    await useAuditStore.getState().startAudit(mockAudit.url);

    expect(notifyAuditCompleted).toHaveBeenCalledWith('project-regression', mockAudit, 98);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-regression_audit_history') || '[]')[0].health_score).toBe(95);
  });

it('does not expose the raw storage quota error from a page audit', async () => {
    const projectId = 'project-audit-quota';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('The quota has been exceeded.'));

    await useAuditStore.getState().startAudit(mockAudit.url);

    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.persistence.localQuota'));
    expect(useAuditStore.getState().currentAudit).toBeNull();
  });

it('recovers page-audit history when the first durable snapshot hits quota', async () => {
    const projectId = 'project-audit-history-recovery';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    const originalSetItem = Storage.prototype.setItem;
    let historyWrites = 0;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(this: Storage, key: string, value: string) {
      if (key.includes('audit_history') && historyWrites++ === 0) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    });

    await useAuditStore.getState().startAudit(mockAudit.url);

    expect(useAuditStore.getState().error).toBeNull();
    expect(useAuditStore.getState().currentAudit).toEqual(mockAudit);
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_audit_history`) || '[]')[0]).toMatchObject({ url: mockAudit.url });
    setItem.mockRestore();
  });

it('does not trigger a paid DataForSEO request as a side effect of a page audit', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-explicit-data');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await useAuditStore.getState().startAudit(mockAudit.url);

    expect(fetchMock).not.toHaveBeenCalled();
  });

it('persists live DataForSEO evidence per project and restores it only for the matching audit host', async () => {
    const projectId = 'project-live-evidence';
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem(`seomi_project_${projectId}_audit_history`, JSON.stringify([mockAudit]));
    useAuditStore.getState().hydrateProject(projectId);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    const summary = { target: 'example.com', total_backlinks: 12, referring_domains: 4, referring_main_domains: 3, rank: 55, dofollow_backlinks: 8, broken_backlinks: 1 };
    const serp = [{ type: 'organic', rank_group: 1, rank_absolute: 1, domain: 'example.com', title: 'Result', description: 'Description', url: 'https://example.com/result' }];
    dataForSeoMocks.getBacklinksSummary.mockResolvedValue(summary);
    dataForSeoMocks.getSerpCompetitors.mockResolvedValue(serp);

    await useAuditStore.getState().fetchDataForSEO('example.com');
    await useAuditStore.getState().fetchDataForSEOSerp('technical seo', 2840);

    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_dataforseo_summary_v1`) || 'null')).toEqual(summary);
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_dataforseo_serp_v1`) || '[]')).toEqual(serp);

    useAuditStore.getState().hydrateProject(projectId);
    expect(useAuditStore.getState().dataforseoData).toEqual(summary);
    expect(useAuditStore.getState().dataforseoSerp).toEqual(serp);

    localStorage.setItem(`seomi_project_${projectId}_audit_history`, JSON.stringify([{ ...mockAudit, final_url: 'https://other.example/' }]));
    useAuditStore.getState().hydrateProject(projectId);
    expect(useAuditStore.getState().dataforseoData).toBeNull();
    expect(useAuditStore.getState().dataforseoSerp).toEqual([]);
  });
});
