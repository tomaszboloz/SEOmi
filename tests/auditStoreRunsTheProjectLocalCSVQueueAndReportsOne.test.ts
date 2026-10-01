import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuditStore } from '../src/stores/auditStore';
import { PageAuditData } from '../src/types';
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

it('runs the project-local CSV queue and reports one bounded batch summary', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-batch');
    localStorage.setItem('seomi_project_project-batch_audit_history', JSON.stringify([{ ...mockAudit, health_score: 98 }]));
    useAuditStore.getState().hydrateProject('project-batch');
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);

    await useAuditStore.getState().startBatchAudits();

    expect(useAuditStore.getState().batchItems).toMatchObject([{ url: 'https://example.com/', status: 'completed' }]);
    expect(notifyAuditCompleted).not.toHaveBeenCalled();
    expect(notifyBatchCompleted).toHaveBeenCalledWith('project-batch', {
      completed: 1,
      failed: 0,
      queued: 0,
      regressionCount: 1,
      stopped: false,
    });
    expect(useAuditStore.getState().currentAudit).toEqual(mockAudit);
  });

it('arms and disarms the native queue wake-up around a foreground run', async () => {
    const projectId = 'project-queue-wakeup';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    useAuditStore.getState().hydrateProject(projectId);
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);

    await useAuditStore.getState().startBatchAudits();

    await vi.waitFor(() => expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command]) => command === 'register_audit_queue_wakeup')).toBe(true));
    await vi.waitFor(() => expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command]) => command === 'unregister_audit_queue_wakeup')).toBe(true));
  });

it('keeps a batch result out of a newly selected project while the source queue finishes', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-batch-source');
    useAuditStore.getState().hydrateProject('project-batch-source');
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com');
    vi.mocked(invokeTauriCommand).mockImplementation(async () => {
      localStorage.setItem('seomi_active_project_v1', 'project-batch-next');
      return mockAudit;
    });

    await useAuditStore.getState().startBatchAudits();

    expect(useAuditStore.getState().currentAudit).toBeNull();
    expect(JSON.parse(localStorage.getItem('seomi_project_project-batch-source_audit_history') || '[]')[0].url).toBe(mockAudit.url);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-batch-source_audit_queue_v1') || '[]')).toMatchObject([{ status: 'completed' }]);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-batch-next_audit_queue_v1') || '[]')).toEqual([]);
    expect(notifyAuditCompleted).not.toHaveBeenCalled();
    expect(notifyBatchCompleted).toHaveBeenCalledWith('project-batch-source', {
      completed: 1,
      failed: 0,
      queued: 0,
      regressionCount: 0,
      stopped: false,
    });
  });

it('keeps a newer project batch running while an older project batch finishes', async () => {
    const sourceProject = 'project-batch-overlap-source';
    const nextProject = 'project-batch-overlap-next';
    localStorage.setItem('seomi_active_project_v1', sourceProject);
    useAuditStore.getState().hydrateProject(sourceProject);
    useAuditStore.getState().importAuditCsv('url\nhttps://source.example');

    const resolvers: Array<(value: PageAuditData) => void> = [];
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'inspect_url') {
        return new Promise<PageAuditData>((resolve) => { resolvers.push(resolve); }) as never;
      }
      return undefined as never;
    });

    const sourceRun = useAuditStore.getState().startBatchAudits();
    await vi.waitFor(() => expect(useAuditStore.getState().activeBatchRequestId).toBeTruthy());

    localStorage.setItem('seomi_active_project_v1', nextProject);
    useAuditStore.getState().hydrateProject(nextProject);
    useAuditStore.getState().importAuditCsv('url\nhttps://next.example');
    const nextRun = useAuditStore.getState().startBatchAudits();
    await vi.waitFor(() => expect(useAuditStore.getState().activeBatchRequestId).toBeTruthy());
    const nextRequestId = useAuditStore.getState().activeBatchRequestId;

    resolvers[0]?.({ ...mockAudit, url: 'https://source.example/', final_url: 'https://source.example/' });
    await sourceRun;

    expect(useAuditStore.getState()).toMatchObject({
      isBatchRunning: true,
      activeBatchRequestId: nextRequestId,
    });

    resolvers[1]?.({ ...mockAudit, url: 'https://next.example/', final_url: 'https://next.example/' });
    await nextRun;
    expect(useAuditStore.getState().isBatchRunning).toBe(false);
    expect(useAuditStore.getState().batchItems).toMatchObject([{ url: 'https://next.example/', status: 'completed' }]);
  });
});
