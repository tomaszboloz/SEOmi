import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), notify: vi.fn(), wakeup: vi.fn(() => Promise.resolve()), snapshot: vi.fn() }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: mocks.invoke, isTauriEnvironment: () => true }));
vi.mock('@/services/desktopNotifications', () => ({ notifyBatchCompleted: mocks.notify }));
vi.mock('@/services/scheduleWakeup', () => ({ syncAuditQueueWakeup: mocks.wakeup }));
vi.mock('@/stores/audit/auditNative', () => ({ persistNativeBatchSnapshot: mocks.snapshot }));

import i18n from '@/i18n';
import { runBatchAudits } from '@/stores/audit/auditBatchRunner';
import { batchQueueKey, historyKey, state as runtimeState } from '@/stores/audit/auditConstants';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';

const item = (id: string, status = 'queued') => ({ id, url: `https://a.test/${id}`, status });
const page = (url: string, score: number) => ({ url, final_url: url, health_score: score });
const run = () => runBatchAudits(useAuditStore.getState, useAuditStore.setState as never);
const seed = (batchItems: unknown[], extra: Record<string, unknown> = {}) => useAuditStore.setState({ batchItems, batchRun: null, currentAudit: null, isBatchRunning: false, isBatchStopping: false, error: null, history: [], ...extra } as never);
const queue = () => JSON.parse(localStorage.getItem(batchQueueKey('p1'))!) as Array<{ id: string; status: string; attempts?: number; error?: string }>;

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  runtimeState.activeBatchProjectId = null;
  await i18n.changeLanguage('en');
  localStorage.setItem('seomi_active_project_v1', 'p1');
  useProjectStore.setState({ activeProjectId: 'p1' });
});

describe('preconditions', () => {
  it('needs a project and does not start a second run', async () => {
    localStorage.removeItem('seomi_active_project_v1');
    useProjectStore.setState({ activeProjectId: null });
    seed([item('a')]);
    await run();
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.tools.projectRequired'));
    localStorage.setItem('seomi_active_project_v1', 'p1');
    seed([item('a')], { isBatchRunning: true });
    await run();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});

describe('processing the queue', () => {
  it('audits queued, failed and interrupted items only, saves history and reports regressions', async () => {
    // Regressions are measured against the project's stored history.
    localStorage.setItem(historyKey('p1'), JSON.stringify([page('https://a.test/a', 90)]));
    seed([item('a'), item('b', 'completed'), item('c', 'failed'), item('d', 'interrupted')]);
    mocks.invoke.mockImplementation(async (_cmd: string, args: { url: string }) => page(args.url, 70));
    await run();
    expect(mocks.invoke.mock.calls.map((call) => call[1].url)).toEqual(['https://a.test/a', 'https://a.test/c', 'https://a.test/d']);
    expect(queue().map((entry) => entry.status)).toEqual(['completed', 'completed', 'completed', 'completed']);
    expect(queue()[0].attempts).toBe(1);
    expect(useAuditStore.getState()).toMatchObject({ isBatchRunning: false, activeBatchRequestId: null, batchRun: { status: 'completed' } });
    expect(useAuditStore.getState().history[0]).toMatchObject({ url: 'https://a.test/d' });
    expect(mocks.notify).toHaveBeenCalledWith('p1', { completed: 3, failed: 0, queued: 0, regressionCount: 1, stopped: false });
    expect(runtimeState.activeBatchProjectId).toBeNull();
  });

  it('marks a failing item, continues with the rest and finishes as stopped with a retry pending', async () => {
    seed([item('a'), item('b')]);
    mocks.invoke.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(page('https://a.test/b', 80));
    await run();
    expect(queue().map((entry) => entry.status)).toEqual(['failed', 'completed']);
    expect(queue()[0].error).toContain('timeout');
    expect(useAuditStore.getState().batchRun).toMatchObject({ status: 'stopped' });
    // A failed item is retryable but not queued, so the notification is not flagged as stopped.
    expect(mocks.notify).toHaveBeenCalledWith('p1', expect.objectContaining({ completed: 1, failed: 1, queued: 0, stopped: false }));
  });

  it('stops between items when a stop was requested and returns the item to the queue', async () => {
    seed([item('a'), item('b')]);
    mocks.invoke.mockImplementation(async () => {
      useAuditStore.setState({ isBatchStopping: true });
      throw new Error('cancelled');
    });
    await run();
    expect(queue().map((entry) => entry.status)).toEqual(['queued', 'queued']);
    expect(queue()[0].error).toBe(i18n.t('runtimeErrors.audit.batchStopped'));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(useAuditStore.getState().batchRun).toMatchObject({ status: 'stopped' });
    expect(mocks.notify).toHaveBeenCalledWith('p1', expect.objectContaining({ failed: 0, queued: 2, stopped: true }));
  });

  it('records the wake-up lifecycle and surfaces a failing wake-up', async () => {
    seed([item('a')]);
    mocks.invoke.mockResolvedValue(page('https://a.test/a', 80));
    mocks.wakeup.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('scheduler down'));
    await run();
    expect(mocks.wakeup).toHaveBeenNthCalledWith(1, 'p1', expect.any(String), true);
    expect(mocks.wakeup).toHaveBeenNthCalledWith(2, 'p1', expect.any(String), false);
    await Promise.resolve();
  });

  it('does not touch another project that became active during the run', async () => {
    seed([item('a')]);
    mocks.invoke.mockImplementation(async () => {
      localStorage.setItem('seomi_active_project_v1', 'p2');
      useProjectStore.setState({ activeProjectId: 'p2' });
      return page('https://a.test/a', 80);
    });
    await run();
    expect(useAuditStore.getState().currentAudit).toBeNull();
    expect(JSON.parse(localStorage.getItem(batchQueueKey('p1'))!)[0].status).toBe('completed');
  });
});
