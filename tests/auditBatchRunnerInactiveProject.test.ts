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
import { state as runtimeState } from '@/stores/audit/auditConstants';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';

const item = (id: string) => ({ id, url: `https://a.test/${id}`, status: 'queued' });
const page = (url: string) => ({ url, final_url: url, health_score: 80 });
const run = () => runBatchAudits(useAuditStore.getState, useAuditStore.setState as never);
const seed = (extra: Record<string, unknown> = {}) => useAuditStore.setState({ batchItems: [item('a')], batchRun: null, currentAudit: null, isBatchRunning: false, isBatchStopping: false, error: null, history: [], selectedUserAgent: '', batchWakeupError: null, ...extra } as never);

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

const switchAway = () => {
  localStorage.setItem('seomi_active_project_v1', 'p2');
  useProjectStore.setState({ activeProjectId: 'p2' });
};

describe('when the source project is no longer active', () => {
  it('keeps queue, history and wake-up failures out of the new project state', async () => {
    seed();
    mocks.wakeup.mockImplementation(async () => { switchAway(); throw new Error('scheduler down'); });
    mocks.write.mockReturnValue(false);
    mocks.persist.mockReturnValue({ saved: false });
    await run();
    await new Promise((r) => setTimeout(r, 0));
    expect(useAuditStore.getState()).toMatchObject({ error: null, batchWakeupError: null, currentAudit: null });
    expect(mocks.invoke).toHaveBeenCalledWith('inspect_url', expect.anything());
  });

  it('ignores thrown storage and history errors for the inactive project', async () => {
    seed();
    mocks.wakeup.mockImplementation(async () => { switchAway(); });
    mocks.write.mockImplementation(() => { throw new Error('denied'); });
    mocks.persist.mockImplementation(() => { throw new Error('disk gone'); });
    await run();
    expect(useAuditStore.getState().error).toBeNull();
  });

  it('leaves the active-batch marker alone when another project took over', async () => {
    seed();
    mocks.invoke.mockImplementation(async (_c: string, a: { url: string }) => {
      runtimeState.activeBatchProjectId = 'p9';
      return page(a.url);
    });
    await run();
    expect(runtimeState.activeBatchProjectId).toBe('p9');
  });
});
