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

it('imports headless queue results and acknowledges only durable handoffs', async () => {
    const projectId = 'project-native-audit-results';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    const headlessAudit = { ...mockAudit, url: 'https://example.com/headless', final_url: 'https://example.com/headless' };
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_audit_queue') {
        return {
          items: [{ id: 'item-headless', url: headlessAudit.url, status: 'completed' }],
          run: { id: 'run-headless', status: 'completed', startedAt: headlessAudit.timestamp, updatedAt: headlessAudit.timestamp },
        } as never;
      }
      if (command === 'list_project_audit_queue_results') {
        return [{ runId: 'run-headless', itemId: 'item-headless', audit: headlessAudit }] as never;
      }
      if (command === 'list_project_audit_queue_executions') {
        return [{ runId: 'run-headless' }] as never;
      }
      return undefined as never;
    });

    useAuditStore.getState().hydrateProject(projectId);

    await vi.waitFor(() => expect(useAuditStore.getState().currentAudit?.url).toBe(headlessAudit.url));
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_audit_history`) || '[]')[0].url).toBe(headlessAudit.url);
    expect(vi.mocked(invokeTauriCommand).mock.calls).toContainEqual([
      'acknowledge_project_audit_queue_result',
      { projectId, runId: 'run-headless', itemId: 'item-headless' },
    ]);
    expect(vi.mocked(invokeTauriCommand).mock.calls).toContainEqual([
      'acknowledge_project_audit_queue_execution',
      { projectId, runId: 'run-headless' },
    ]);
  });

it('resumes only unfinished queue items and keeps the original run identity', async () => {
    const projectId = 'project-resume';
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem(`seomi_project_${projectId}_audit_queue_v1`, JSON.stringify([
      { id: 'done', url: 'https://example.com/done', status: 'completed' },
      { id: 'pending', url: 'https://example.com/pending', status: 'interrupted' },
    ]));
    localStorage.setItem(`seomi_project_${projectId}_audit_queue_run_v1`, JSON.stringify({
      id: 'run-resume', status: 'interrupted', startedAt: '2026-09-24T09:00:00.000Z', updatedAt: '2026-09-24T09:30:00.000Z',
    }));
    useAuditStore.getState().hydrateProject(projectId);
    vi.mocked(invokeTauriCommand).mockResolvedValue({ ...mockAudit, url: 'https://example.com/pending', final_url: 'https://example.com/pending' });

    await useAuditStore.getState().startBatchAudits();

    expect(vi.mocked(invokeTauriCommand).mock.calls.filter(([command]) => command === 'inspect_url')).toHaveLength(1);
    expect(vi.mocked(invokeTauriCommand).mock.calls[0][1]).toMatchObject({ url: 'https://example.com/pending' });
    expect(useAuditStore.getState().batchRun).toMatchObject({ id: 'run-resume', status: 'completed' });
    expect(useAuditStore.getState().batchItems).toMatchObject([
      { id: 'done', status: 'completed' },
      { id: 'pending', status: 'completed' },
    ]);
  });
});
