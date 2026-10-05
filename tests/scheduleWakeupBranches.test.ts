import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), native: true, apply: vi.fn() }));
vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => mocks.native, invokeTauriCommand: mocks.invoke }));
vi.mock('@/services/auditSchedule', async (orig) => ({ ...(await orig<object>()), applyScheduledExecution: mocks.apply }));

import {
  acknowledgeScheduledExecution, getScheduledLaunchContext, reconcileScheduledExecutions, removeAuditWakeup, syncAuditQueueWakeup, syncAuditWakeup,
} from '@/services/scheduleWakeup';
import type { ScheduledAudit } from '@/services/auditSchedule';

const schedule = (over: object = {}) => ({ id: 's1', url: 'https://a.test/', intervalHours: 24, enabled: true, status: 'idle', createdAt: 'c', nextRunAt: 'n', ...over }) as unknown as ScheduledAudit;
const names = () => mocks.invoke.mock.calls.map((c) => c[0]);

describe('scheduleWakeup native bridge', () => {
  beforeEach(() => { mocks.invoke.mockReset().mockResolvedValue(undefined); mocks.apply.mockReset(); mocks.native = true; });

  it('deletes and unregisters a disabled schedule, and does nothing without one', async () => {
    await syncAuditWakeup('p', schedule({ enabled: false }));
    expect(mocks.invoke.mock.calls).toEqual([['delete_scheduled_task', { projectId: 'p', scheduleId: 's1' }], ['unregister_audit_wakeup', { projectId: 'p', scheduleId: 's1' }]]);
    mocks.invoke.mockClear();
    await syncAuditWakeup('p', undefined);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('defaults the task type and run history when saving an enabled schedule', async () => {
    await syncAuditWakeup('p', schedule());
    expect(mocks.invoke.mock.calls[0][1].task).toMatchObject({ taskType: 'page-audit', runHistory: [], scheduleId: 's1' });
    expect(names()).toEqual(['save_scheduled_task', 'register_audit_wakeup']);
    mocks.invoke.mockClear();
    await syncAuditWakeup('p', schedule({ taskType: 'site-crawl', runHistory: [{ x: 1 }] }));
    expect(mocks.invoke.mock.calls[0][1].task).toMatchObject({ taskType: 'site-crawl', runHistory: [{ x: 1 }] });
  });

  it('is inert outside the desktop app', async () => {
    mocks.native = false;
    await syncAuditWakeup('p', schedule());
    await removeAuditWakeup('p', 's1');
    await syncAuditQueueWakeup('p', 'r', true);
    await acknowledgeScheduledExecution('p', 's1');
    expect(await reconcileScheduledExecutions('p')).toEqual([]);
    expect(await getScheduledLaunchContext()).toEqual({ projectId: null, scheduleId: null, headless: false });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('runs writes for one schedule in order and survives an earlier failure', async () => {
    const order: string[] = [];
    mocks.invoke.mockImplementationOnce(async () => { order.push('save-start'); await new Promise((r) => setTimeout(r, 10)); order.push('save-fail'); throw new Error('boom'); });
    const first = syncAuditWakeup('p', schedule());
    const second = removeAuditWakeup('p', 's1');
    await expect(first).rejects.toThrow('boom');
    await second;
    expect(order).toEqual(['save-start', 'save-fail']);
    expect(names()).toEqual(['save_scheduled_task', 'delete_scheduled_task', 'unregister_audit_wakeup']);
  });

  it('arms and disarms a CSV queue wake-up ten minutes ahead', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    try {
      await syncAuditQueueWakeup('p', 'run1', true);
      expect(mocks.invoke).toHaveBeenCalledWith('register_audit_queue_wakeup', { projectId: 'p', runId: 'run1', nextRunAt: '2026-01-01T00:10:00.000Z' });
      await syncAuditQueueWakeup('p', 'run1', false);
      expect(mocks.invoke).toHaveBeenLastCalledWith('unregister_audit_queue_wakeup', { projectId: 'p', runId: 'run1' });
      mocks.invoke.mockClear();
      await syncAuditQueueWakeup('p', null, true);
      expect(mocks.invoke).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('propagates queue failures yet lets the next write proceed', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('queue down'));
    await expect(syncAuditQueueWakeup('p', 'r2', true)).rejects.toThrow('queue down');
    await syncAuditQueueWakeup('p', 'r2', false);
    expect(names()).toEqual(['register_audit_queue_wakeup', 'unregister_audit_queue_wakeup']);
  });

  it('serializes concurrent queue writes for the same run', async () => {
    const order: string[] = [];
    mocks.invoke.mockImplementation(async (name: string) => { order.push(`${name}:start`); await new Promise((r) => setTimeout(r, 5)); order.push(`${name}:end`); });
    await Promise.all([syncAuditQueueWakeup('p', 'r3', true), syncAuditQueueWakeup('p', 'r3', false)]);
    expect(order).toEqual(['register_audit_queue_wakeup:start', 'register_audit_queue_wakeup:end', 'unregister_audit_queue_wakeup:start', 'unregister_audit_queue_wakeup:end']);
  });

  it('lets a queued write run after the previous queue write rejected', async () => {
    mocks.invoke.mockImplementationOnce(async () => { await new Promise((r) => setTimeout(r, 5)); throw new Error('first'); });
    const first = syncAuditQueueWakeup('p', 'r4', true);
    const second = syncAuditQueueWakeup('p', 'r4', false);
    await expect(first).rejects.toThrow('first');
    await expect(second).resolves.toBeUndefined();
    expect(names()).toEqual(['register_audit_queue_wakeup', 'unregister_audit_queue_wakeup']);
  });

  it('returns only handoffs that map to a local schedule', async () => {
    const handoffs = [{ scheduleId: 'a' }, { scheduleId: 'b' }, { scheduleId: 'c' }];
    mocks.invoke.mockResolvedValueOnce(handoffs);
    mocks.apply.mockReturnValueOnce({}).mockReturnValueOnce(null).mockReturnValueOnce({});
    expect(await reconcileScheduledExecutions('p')).toEqual([handoffs[0], handoffs[2]]);
    expect(mocks.invoke).toHaveBeenCalledWith('list_scheduled_executions', { projectId: 'p' });
  });

  it('acknowledges a handoff and reads the launch context natively', async () => {
    await acknowledgeScheduledExecution('p', 's9');
    expect(mocks.invoke).toHaveBeenCalledWith('acknowledge_scheduled_execution', { projectId: 'p', scheduleId: 's9' });
    mocks.invoke.mockResolvedValueOnce({ projectId: 'p', scheduleId: 's9', headless: true });
    expect(await getScheduledLaunchContext()).toEqual({ projectId: 'p', scheduleId: 's9', headless: true });
  });
});
