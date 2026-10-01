import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuditStore } from '../src/stores/auditStore';

import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { notifyAuditCompleted, notifyBatchCompleted } from '@/services/desktopNotifications';
import { useSettingsStore } from '@/stores/settingsStore';
import i18n from '@/i18n';

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

it('cancels the in-flight audit and leaves that URL queued for resume', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-cancel');
    useAuditStore.getState().hydrateProject('project-cancel');
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com');
    let rejectAudit!: (error: Error) => void;
    vi.mocked(invokeTauriCommand).mockImplementation((command) => {
      if (command === 'inspect_url') {
        return new Promise((_, reject) => { rejectAudit = reject; });
      }
      return Promise.resolve(true);
    });

    const running = useAuditStore.getState().startBatchAudits();
    await vi.waitFor(() => expect(useAuditStore.getState().activeBatchRequestId).toBeTruthy());
    useAuditStore.getState().stopBatchAudits();
    rejectAudit(new Error('Audit cancelled by user.'));
    await running;

    expect(useAuditStore.getState().batchItems).toMatchObject([
      { url: 'https://example.com/', status: 'queued' },
    ]);
    expect(useAuditStore.getState().batchRun?.status).toBe('stopped');
    expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command]) => command === 'cancel_inspect_url')).toBe(true);
  });

it('recovers a running queue as interrupted after a restart', () => {
    const projectId = 'project-restart';
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem(`seomi_project_${projectId}_audit_queue_v1`, JSON.stringify([
      { id: 'active', url: 'https://example.com/active', status: 'running' },
      { id: 'done', url: 'https://example.com/done', status: 'completed', completedAt: '2026-09-24T10:00:00.000Z' },
    ]));
    localStorage.setItem(`seomi_project_${projectId}_audit_queue_run_v1`, JSON.stringify({
      id: 'run-1', status: 'running', startedAt: '2026-09-24T09:00:00.000Z', updatedAt: '2026-09-24T09:30:00.000Z', activeItemId: 'active',
    }));

    useAuditStore.getState().hydrateProject(projectId);

    expect(useAuditStore.getState().batchItems).toMatchObject([
      { id: 'active', status: 'interrupted', error: i18n.t('runtimeErrors.audit.batchInterrupted') },
      { id: 'done', status: 'completed' },
    ]);
    expect(useAuditStore.getState().batchRun).toMatchObject({ id: 'run-1', status: 'interrupted', activeItemId: 'active' });
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_audit_queue_v1`) || '[]')[0].status).toBe('interrupted');
  });

it('hydrates a native queue snapshot and marks an in-flight item resumable', async () => {
    const projectId = 'project-native-audit-queue';
    const snapshot = {
      items: [{ id: 'active', url: 'https://example.com/active', status: 'running', updatedAt: '2026-09-25T10:00:00.000Z' }],
      run: { id: 'run-native', status: 'running', startedAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T10:00:00.000Z', activeItemId: 'active' },
    };
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_audit_queue') return snapshot as never;
      return undefined as never;
    });

    useAuditStore.getState().hydrateProject(projectId);

    await vi.waitFor(() => expect(useAuditStore.getState().batchItems).toMatchObject([
      { id: 'active', status: 'interrupted', error: i18n.t('runtimeErrors.audit.batchInterrupted') },
    ]));
    expect(useAuditStore.getState().batchRun).toMatchObject({ id: 'run-native', status: 'interrupted' });
    expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command]) => command === 'save_project_audit_queue')).toBe(true);
  });

it('writes imported batch URLs to the native project snapshot', async () => {
    const projectId = 'project-native-audit-import';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_audit_queue') return null as never;
      return undefined as never;
    });

    useAuditStore.getState().hydrateProject(projectId);
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com/native');

    await vi.waitFor(() => expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command, args]) => (
      command === 'save_project_audit_queue'
      && JSON.stringify(args).includes('https://example.com/native')
    ))).toBe(true));
  });
});
