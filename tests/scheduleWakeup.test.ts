import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invokeTauriCommand: vi.fn(),
  native: true,
}));

vi.mock('@/services/tauri', () => ({
  isTauriEnvironment: () => mocks.native,
  invokeTauriCommand: mocks.invokeTauriCommand,
}));

import { acknowledgeScheduledExecution, getScheduledLaunchContext, removeAuditWakeup, syncAuditWakeup } from '@/services/scheduleWakeup';
import type { ScheduledAudit } from '@/services/auditSchedule';

const schedule = (overrides: Partial<ScheduledAudit> = {}): ScheduledAudit => ({
  id: 'schedule-race',
  url: 'https://example.com/',
  taskType: 'page-audit',
  intervalHours: 24,
  enabled: true,
  status: 'scheduled',
  createdAt: '2026-09-26T08:00:00.000Z',
  nextRunAt: '2026-09-27T08:00:00.000Z',
  runHistory: [],
  ...overrides,
});

const commands = (): string[] => mocks.invokeTauriCommand.mock.calls.map(([command]) => command as string);

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('schedule wake-up write ordering', () => {
  beforeEach(() => {
    mocks.native = true;
    mocks.invokeTauriCommand.mockReset();
    mocks.invokeTauriCommand.mockResolvedValue(undefined);
  });

  it('returns an inert browser launch context and never acknowledges native work there', async () => {
    mocks.native = false;
    await expect(getScheduledLaunchContext()).resolves.toEqual({ projectId: null, scheduleId: null, headless: false });
    await acknowledgeScheduledExecution('project-a', 'schedule-a');
    await syncAuditWakeup('project-a', schedule());
    await removeAuditWakeup('project-a', 'schedule-a');
    expect(mocks.invokeTauriCommand).not.toHaveBeenCalled();
  });

  it('preserves native launch context and propagates lookup failures', async () => {
    const context = { projectId: 'project-a', scheduleId: 'schedule-a', headless: true };
    mocks.invokeTauriCommand.mockResolvedValue(context);
    await expect(getScheduledLaunchContext()).resolves.toBe(context);
    expect(mocks.invokeTauriCommand).toHaveBeenCalledExactlyOnceWith('scheduled_launch_context');
    mocks.invokeTauriCommand.mockRejectedValue(new Error('invalid launch arguments'));
    await expect(getScheduledLaunchContext()).rejects.toThrow('invalid launch arguments');
  });

  it('acknowledges precisely one project schedule and exposes failed acknowledgment', async () => {
    await acknowledgeScheduledExecution('project-a', 'schedule-a');
    expect(mocks.invokeTauriCommand).toHaveBeenCalledExactlyOnceWith('acknowledge_scheduled_execution', {
      projectId: 'project-a', scheduleId: 'schedule-a',
    });
    mocks.invokeTauriCommand.mockRejectedValue(new Error('handoff remains pending'));
    await expect(acknowledgeScheduledExecution('project-b', 'schedule-b')).rejects.toThrow('handoff remains pending');
  });

  it('serializes an update before a remove for the same schedule', async () => {
    let releaseSave!: () => void;
    const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
    mocks.invokeTauriCommand.mockImplementation((command: string) => command === 'save_scheduled_task' ? saveGate : Promise.resolve());

    const update = syncAuditWakeup('project-race', schedule());
    await flushMicrotasks();
    expect(commands()).toEqual(['save_scheduled_task']);

    const remove = removeAuditWakeup('project-race', 'schedule-race');
    await flushMicrotasks();
    expect(commands()).toEqual(['save_scheduled_task']);

    releaseSave();
    await Promise.all([update, remove]);
    expect(commands()).toEqual([
      'save_scheduled_task',
      'register_audit_wakeup',
      'delete_scheduled_task',
      'unregister_audit_wakeup',
    ]);
  });

  it('continues with the newest operation after an older native write fails', async () => {
    mocks.invokeTauriCommand
      .mockRejectedValueOnce(new Error('stale save failed'))
      .mockResolvedValue(undefined);

    await expect(syncAuditWakeup('project-race', schedule())).rejects.toThrow('stale save failed');
    await expect(removeAuditWakeup('project-race', 'schedule-race')).resolves.toBeUndefined();
    expect(commands()).toEqual([
      'save_scheduled_task',
      'delete_scheduled_task',
      'unregister_audit_wakeup',
    ]);
  });
});
