import { beforeEach, expect, it, vi } from 'vitest';
import { useAuditStore } from '@/stores/auditStore';
import { resolveGlobalAiPreferences } from '@/stores/auth/runtime';
import { gscSliceFixture } from './fixtures/gscSliceDirect';
import { gscData } from './fixtures/gscTracker';

const mocks = vi.hoisted(() => ({ wakeup: vi.fn() }));
vi.mock('@/services/scheduleWakeup', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/scheduleWakeup')>()), syncAuditQueueWakeup: mocks.wakeup }));

beforeEach(() => {
  localStorage.clear();
  mocks.wakeup.mockReset().mockResolvedValue(undefined);
});

it('keeps a stored valid connection method and defaults an invalid one in global preferences', () => {
  localStorage.setItem('seomi_ai_connection_openai', 'local_cli');
  localStorage.setItem('seomi_ai_connection_claude', 'bogus');
  const { connectionMethod } = resolveGlobalAiPreferences();
  expect(connectionMethod.openai).toBe('local_cli');
  expect(connectionMethod.claude).toBe('api_key');
});

it('clears the queue of a project without a run and does not touch the wakeup', () => {
  localStorage.setItem('seomi_active_project_v1', 'project-z');
  useAuditStore.setState({ batchItems: [], batchRun: null, isBatchRunning: false });
  useAuditStore.getState().clearBatchAudits();
  expect(useAuditStore.getState().batchRun).toBeNull();
  expect(mocks.wakeup).not.toHaveBeenCalled();
});

it('requests GSC data with empty filters when neither the call nor the store provides any', async () => {
  const { actions, store, invoke } = gscSliceFixture();
  store.setState({ gscFilters: undefined as unknown as Record<string, never> });
  invoke.mockResolvedValueOnce(gscData());
  await actions.refreshGscData();
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(invoke.mock.calls[0][1]).toMatchObject({ siteUrl: 'sc-domain:example.com' });
  expect(store.getState().gscData).toEqual(gscData());
});

it('ignores a wakeup failure that settles after the active project changed', async () => {
  localStorage.setItem('seomi_active_project_v1', 'project-a');
  let reject: (error: Error) => void = () => undefined;
  mocks.wakeup.mockReturnValue(new Promise<void>((_, fail) => { reject = fail; }));
  useAuditStore.setState({ batchItems: [], batchRun: { id: 'run-9', status: 'completed', startedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } as never, isBatchRunning: false, batchWakeupError: null });
  useAuditStore.getState().clearBatchAudits();
  localStorage.setItem('seomi_active_project_v1', 'project-b');
  reject(new Error('late failure'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mocks.wakeup).toHaveBeenCalledWith('project-a', 'run-9', false);
  expect(useAuditStore.getState().batchWakeupError).toBeNull();
});
