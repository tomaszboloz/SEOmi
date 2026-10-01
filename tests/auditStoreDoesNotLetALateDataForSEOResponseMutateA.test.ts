import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuditStore } from '../src/stores/auditStore';
import { DataForSEOBacklinkSummary, PageAuditData } from '../src/types';
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

it('does not let a late DataForSEO response mutate a newly selected project', async () => {
    const sourceProject = 'project-data-source';
    localStorage.setItem('seomi_active_project_v1', sourceProject);
    useAuditStore.getState().hydrateProject(sourceProject);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    let resolveSummary!: (value: DataForSEOBacklinkSummary) => void;
    dataForSeoMocks.getBacklinksSummary.mockReturnValue(new Promise((resolve) => { resolveSummary = resolve; }));

    const pending = useAuditStore.getState().fetchDataForSEO('example.com');
    localStorage.setItem('seomi_active_project_v1', 'project-data-next');
    useAuditStore.getState().hydrateProject('project-data-next');
    resolveSummary({ target: 'example.com', total_backlinks: 1, referring_domains: 1, referring_main_domains: 1, rank: 1, dofollow_backlinks: 1, broken_backlinks: 0 });
    await pending;

    expect(useAuditStore.getState().dataforseoData).toBeNull();
    expect(localStorage.getItem('seomi_project_project-data-next_dataforseo_summary_v1')).toBeNull();
    expect(JSON.parse(localStorage.getItem('seomi_project_project-data-source_dataforseo_summary_v1') || 'null')).toMatchObject({ target: 'example.com' });
  });

it('keeps the newest DataForSEO summary when same-project requests finish out of order', async () => {
    const projectId = 'project-data-order';
    localStorage.setItem('seomi_active_project_v1', projectId);
    useAuditStore.getState().hydrateProject(projectId);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    let releaseOld!: (value: DataForSEOBacklinkSummary) => void;
    let calls = 0;
    dataForSeoMocks.getBacklinksSummary.mockImplementation((target: string) => {
      calls += 1;
      if (calls === 1) return new Promise<DataForSEOBacklinkSummary>((resolve) => { releaseOld = resolve; });
      return Promise.resolve({ target, total_backlinks: 99, referring_domains: 9, referring_main_domains: 9, rank: 90, dofollow_backlinks: 99, broken_backlinks: 0 });
    });

    const oldRequest = useAuditStore.getState().fetchDataForSEO('old.example');
    await Promise.resolve();
    const newRequest = useAuditStore.getState().fetchDataForSEO('new.example');
    await newRequest;
    expect(useAuditStore.getState().dataforseoData?.target).toBe('new.example');

    releaseOld({ target: 'old.example', total_backlinks: 1, referring_domains: 1, referring_main_domains: 1, rank: 1, dofollow_backlinks: 1, broken_backlinks: 0 });
    await oldRequest;
    expect(useAuditStore.getState().dataforseoData?.target).toBe('new.example');
    expect(JSON.parse(localStorage.getItem('seomi_project_' + projectId + '_dataforseo_summary_v1') || 'null')).toMatchObject({ target: 'new.example' });
  });

it('saves a running audit to its source project without replacing the newly selected project', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-source');
    useAuditStore.getState().hydrateProject('project-source');
    let resolveAudit!: (data: PageAuditData) => void;
    vi.mocked(invokeTauriCommand).mockReturnValue(new Promise((resolve) => { resolveAudit = resolve; }));

    const runningAudit = useAuditStore.getState().startAudit(mockAudit.url);
    localStorage.setItem('seomi_active_project_v1', 'project-next');
    useAuditStore.getState().hydrateProject('project-next');
    resolveAudit(mockAudit);
    await runningAudit;

    expect(useAuditStore.getState().currentAudit).toBeNull();
    expect(JSON.parse(localStorage.getItem('seomi_project_project-source_audit_history') || '[]')[0].url).toBe(mockAudit.url);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-next_audit_history') || '[]')).toEqual([]);
    expect(notifyAuditCompleted).toHaveBeenCalledWith('project-source', mockAudit, undefined);
  });

it('keeps the newest page audit when same-project requests finish out of order', async () => {
    const projectId = 'project-audit-order';
    localStorage.setItem('seomi_active_project_v1', projectId);
    useAuditStore.getState().hydrateProject(projectId);
    let resolveOld!: (data: PageAuditData) => void;
    let calls = 0;
    const freshAudit = { ...mockAudit, url: 'https://new.example/', final_url: 'https://new.example/', timestamp: '2026-09-26T00:00:02.000Z' };
    const staleAudit = { ...mockAudit, url: 'https://old.example/', final_url: 'https://old.example/', timestamp: '2026-09-26T00:00:01.000Z' };
    vi.mocked(invokeTauriCommand).mockImplementation((command) => {
      if (command !== 'inspect_url') return Promise.resolve(undefined) as never;
      calls += 1;
      if (calls === 1) return new Promise<PageAuditData>((resolve) => { resolveOld = resolve; }) as never;
      return Promise.resolve(freshAudit) as never;
    });

    const oldRequest = useAuditStore.getState().startAudit(staleAudit.url);
    await Promise.resolve();
    const newRequest = useAuditStore.getState().startAudit(freshAudit.url);
    await newRequest;
    expect(useAuditStore.getState().currentAudit?.url).toBe(freshAudit.url);

    resolveOld(staleAudit);
    await oldRequest;
    expect(useAuditStore.getState().currentAudit?.url).toBe(freshAudit.url);
    expect(JSON.parse(localStorage.getItem('seomi_project_' + projectId + '_audit_history') || '[]')).toMatchObject([{ url: freshAudit.url }]);
  });
});
