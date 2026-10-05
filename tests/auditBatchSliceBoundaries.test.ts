import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useAuditStore } from '@/stores/auditStore';
import { state } from '@/stores/audit/auditConstants';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), wakeup: vi.fn() }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: mocks.invoke, isTauriEnvironment: vi.fn(() => false) }));
vi.mock('@/services/desktopNotifications', () => ({ notifyAuditCompleted: vi.fn(), notifyBatchCompleted: vi.fn() }));
vi.mock('@/services/scheduleWakeup', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/scheduleWakeup')>()), syncAuditQueueWakeup: mocks.wakeup }));

const P = 'project-a';
const key = (suffix: string) => `seomi_project_${P}_${suffix}`;
const run = (status = 'running') => ({ id: 'run-1', status, startedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  localStorage.setItem('seomi_active_project_v1', P);
  state.activeBatchProjectId = null;
  mocks.invoke.mockReset().mockResolvedValue(undefined);
  mocks.wakeup.mockReset().mockResolvedValue(undefined);
  useAuditStore.setState({ batchItems: [], batchRun: null, batchRejectedRows: [], isBatchRunning: false, isBatchStopping: false, activeBatchRequestId: null, batchWakeupError: null, error: null });
});

describe('importAuditCsv', () => {
  it('requires a project', () => {
    localStorage.removeItem('seomi_active_project_v1');
    useAuditStore.getState().importAuditCsv('https://a.test');
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.tools.projectRequired'));
  });

  it('queues new URLs, skips already queued ones and persists the queue', () => {
    useAuditStore.getState().importAuditCsv('url\nhttps://a.test/1\nhttps://a.test/2');
    useAuditStore.getState().importAuditCsv('https://a.test/2\nhttps://a.test/3');
    const urls = useAuditStore.getState().batchItems.map((entry) => entry.url);
    expect(urls).toEqual(['https://a.test/1', 'https://a.test/2', 'https://a.test/3']);
    expect(JSON.parse(localStorage.getItem(key('audit_queue_v1')) || '[]')).toHaveLength(3);
    expect(useAuditStore.getState().error).toBeNull();
  });

  it('reports a CSV without a valid URL and keeps rejected rows', () => {
    useAuditStore.getState().importAuditCsv('not a url');
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.audit.csvInvalid'));
    expect(useAuditStore.getState().batchItems).toEqual([]);
  });

  it('reports a queue save failure while keeping the queue in memory', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    useAuditStore.getState().importAuditCsv('https://a.test/1');
    spy.mockRestore();
    expect(useAuditStore.getState().batchItems).toHaveLength(1);
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.audit.queueSave'));
  });
});

describe('stopBatchAudits', () => {
  it('flags the stop, persists the run and cancels the active request', () => {
    useAuditStore.setState({ batchRun: run() as never, activeBatchRequestId: 'req-1' });
    useAuditStore.getState().stopBatchAudits();
    expect(useAuditStore.getState().isBatchStopping).toBe(true);
    expect(useAuditStore.getState().batchRun?.stopRequested).toBe(true);
    expect(JSON.parse(localStorage.getItem(key('audit_queue_run_v1')) || '{}').stopRequested).toBe(true);
    expect(mocks.wakeup).toHaveBeenCalledWith(P, 'run-1', false);
    expect(mocks.invoke).toHaveBeenCalledWith('cancel_inspect_url', { requestId: 'req-1' });
  });

  it('only marks stopping when there is no run and no request', () => {
    useAuditStore.getState().stopBatchAudits();
    expect(useAuditStore.getState().isBatchStopping).toBe(true);
    expect(mocks.wakeup).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('records a wakeup failure only for the still-active project and swallows cancel failures', async () => {
    mocks.wakeup.mockRejectedValue(new Error('boom'));
    mocks.invoke.mockRejectedValue(new Error('gone'));
    useAuditStore.setState({ batchRun: run() as never, activeBatchRequestId: 'req-1' });
    useAuditStore.getState().stopBatchAudits();
    await vi.waitFor(() => expect(useAuditStore.getState().batchWakeupError).toContain('boom'));
    useAuditStore.setState({ batchWakeupError: null });
    mocks.wakeup.mockImplementation(async () => { localStorage.setItem('seomi_active_project_v1', 'other'); throw new Error('late'); });
    localStorage.setItem('seomi_active_project_v1', P);
    useAuditStore.getState().stopBatchAudits();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useAuditStore.getState().batchWakeupError).toBeNull();
  });
});

