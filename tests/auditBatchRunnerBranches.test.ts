import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), wakeup: vi.fn(), snapshot: vi.fn(), write: vi.fn(), persist: vi.fn(), actualWrite: null as unknown, actualPersist: null as unknown }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: mocks.invoke, isTauriEnvironment: () => true }));
vi.mock('@/services/desktopNotifications', () => ({ notifyBatchCompleted: vi.fn() }));
vi.mock('@/services/scheduleWakeup', () => ({ syncAuditQueueWakeup: mocks.wakeup }));
vi.mock('@/stores/audit/auditNative', () => ({ persistNativeBatchSnapshot: mocks.snapshot }));
vi.mock('@/services/storage', async (orig) => {
  const actual = await orig<typeof import('@/services/storage')>();
  mocks.actualWrite = actual.writeStorage;
  return { ...actual, writeStorage: mocks.write };
});
vi.mock('@/stores/audit/auditHelpers', async (orig) => {
  const actual = await orig<typeof import('@/stores/audit/auditHelpers')>();
  mocks.actualPersist = actual.persistAuditHistory;
  return { ...actual, persistAuditHistory: mocks.persist };
});

import i18n from '@/i18n';
import { runBatchAudits } from '@/stores/audit/auditBatchRunner';
import { batchRunKey, state as runtimeState } from '@/stores/audit/auditConstants';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';

const item = (id: string) => ({ id, url: `https://a.test/${id}`, status: 'queued' });
const page = (url: string) => ({ url, final_url: url, health_score: 80 });
const run = () => runBatchAudits(useAuditStore.getState, useAuditStore.setState as never);
const seed = (extra: Record<string, unknown> = {}) => useAuditStore.setState({ batchItems: [item('a')], batchRun: null, currentAudit: null, isBatchRunning: false, isBatchStopping: false, error: null, history: [], selectedUserAgent: '', batchWakeupError: null, ...extra } as never);
const inspectArgs = () => mocks.invoke.mock.calls.find((c) => c[0] === 'inspect_url')![1];

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.write.mockReset().mockImplementation(mocks.actualWrite as never);
  mocks.persist.mockReset().mockImplementation(mocks.actualPersist as never);
  mocks.snapshot.mockReset();
  localStorage.clear();
  runtimeState.activeBatchProjectId = null;
  await i18n.changeLanguage('en');
  localStorage.setItem('seomi_active_project_v1', 'p1');
  useProjectStore.setState({ activeProjectId: 'p1' });
  mocks.wakeup.mockResolvedValue(undefined);
  mocks.invoke.mockImplementation(async (cmd: string, args: { url?: string }) => (cmd === 'inspect_url' ? page(args.url!) : undefined));
});

describe('queue persistence failures', () => {
  it('reports a failed queue write', async () => {
    seed();
    mocks.write.mockReturnValue(false);
    await run();
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.audit.queueSave'));
  });

  it('distinguishes quota errors from other thrown storage errors', async () => {
    seed();
    mocks.write.mockImplementation(() => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); });
    await run();
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.persistence.localQuota'));
    seed();
    mocks.write.mockImplementation(() => { throw new Error('denied'); });
    await run();
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.audit.queueSave'));
  });

  it('reports history persistence that is rejected or throws', async () => {
    seed();
    mocks.persist.mockReturnValueOnce({ saved: false });
    await run();
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.audit.historySave'));
    seed();
    mocks.persist.mockImplementationOnce(() => { throw new Error('disk gone'); });
    await run();
    expect(useAuditStore.getState().error).toBe('disk gone');
    seed();
    mocks.persist.mockImplementationOnce(() => { throw 'odd'; });
    await run();
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.audit.historySave'));
  });
});

describe('wake-up and cancellation', () => {
  it('clears or sets the wake-up error depending on the scheduler result', async () => {
    // Let the wake-up settle while the inspection is still in flight.
    mocks.invoke.mockImplementation(async (_c: string, a: { url: string }) => { await new Promise((r) => setTimeout(r, 5)); return page(a.url); });
    seed({ batchWakeupError: 'stale' });
    await run();
    expect(useAuditStore.getState().batchWakeupError).toBeNull();
    seed();
    mocks.wakeup.mockRejectedValueOnce(new Error('scheduler down'));
    await run();
    expect(useAuditStore.getState().batchWakeupError).toContain('scheduler down');
  });

  it('asks the backend to cancel an inspection requested to stop right before it starts', async () => {
    seed();
    mocks.snapshot.mockImplementation((_p: string, items: Array<{ status: string }>) => {
      if (items[0].status === 'running') useAuditStore.setState({ isBatchStopping: true });
    });
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'cancel_inspect_url') throw new Error('already finished');
      throw new Error('aborted');
    });
    await run();
    const cancel = mocks.invoke.mock.calls.find((c) => c[0] === 'cancel_inspect_url');
    expect(cancel?.[1]).toEqual({ requestId: inspectArgs().requestId });
    expect(useAuditStore.getState().batchRun).toMatchObject({ status: 'stopped' });
  });
});

describe('resuming a previous run', () => {
  const stored = { id: 'run-old', status: 'stopped', startedAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z', stopRequested: false, userAgent: 'StoredBot' };

  it('reuses the persisted run identity and user agent', async () => {
    seed({ selectedUserAgent: 'SelectedBot' });
    localStorage.setItem(batchRunKey('p1'), JSON.stringify(stored));
    await run();
    expect(useAuditStore.getState().batchRun).toMatchObject({ id: 'run-old', startedAt: stored.startedAt, userAgent: 'StoredBot' });
    expect(inspectArgs().userAgent).toBe('StoredBot');
  });

  it('adopts the in-memory run of this project when nothing is persisted', async () => {
    seed({ batchRun: stored });
    runtimeState.activeBatchProjectId = 'p1';
    await run();
    expect(useAuditStore.getState().batchRun?.id).toBe('run-old');
  });

  it('starts a new run using the selected, then the default user agent', async () => {
    seed({ selectedUserAgent: 'SelectedBot' });
    await run();
    expect(useAuditStore.getState().batchRun?.id).not.toBe('run-old');
    expect(inspectArgs().userAgent).toBe('SelectedBot');
    mocks.invoke.mockClear();
    seed();
    localStorage.removeItem(batchRunKey('p1'));
    await run();
    expect(inspectArgs().userAgent).toBe(useSettingsStore.getState().config.default_user_agent);
  });
});
