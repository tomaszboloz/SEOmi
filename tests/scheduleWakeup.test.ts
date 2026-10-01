import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invokeTauriCommand: vi.fn(),
  native: true,
}));

vi.mock('@/services/tauri', () => ({
  isTauriEnvironment: () => mocks.native,
  invokeTauriCommand: mocks.invokeTauriCommand,
}));

import { acknowledgeScheduledExecution, getScheduledLaunchContext, removeAuditWakeup, syncAuditWakeup, syncAuditQueueWakeup, reconcileScheduledExecutions } from '@/services/scheduleWakeup';
import { loadScheduledAudits, addScheduledAudit, setScheduledAuditEnabled, type ScheduledAudit, type ScheduledExecutionHandoff } from '@/services/auditSchedule';

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


describe('queue wake-up and execution reconciliation contracts', () => {
  beforeEach(() => { mocks.native = true; mocks.invokeTauriCommand.mockReset().mockResolvedValue(undefined); localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });

  it('arms the native queue for exactly ten minutes later with opaque identifiers', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T08:00:00Z'));
    await syncAuditQueueWakeup('project-a', 'run-a', true);
    expect(mocks.invokeTauriCommand).toHaveBeenCalledExactlyOnceWith('register_audit_queue_wakeup', {
      projectId: 'project-a', runId: 'run-a', nextRunAt: '2026-10-01T08:10:00.000Z',
    });
  });

  it('removes only the specified queue wake-up when disabled', async () => {
    await syncAuditQueueWakeup('project-a', 'run-a', false);
    expect(mocks.invokeTauriCommand).toHaveBeenCalledExactlyOnceWith('unregister_audit_queue_wakeup', { projectId: 'project-a', runId: 'run-a' });
  });

  it('does not arm absent runs or browser-only work', async () => {
    await syncAuditQueueWakeup('project-a', null, true); mocks.native = false;
    await syncAuditQueueWakeup('project-a', 'run-a', true);
    await expect(reconcileScheduledExecutions('project-a')).resolves.toEqual([]);
    expect(mocks.invokeTauriCommand).not.toHaveBeenCalled();
  });

  it('serializes enabling and disabling the same run before cleanup', async () => {
    let release!: () => void;
    mocks.invokeTauriCommand.mockImplementation(command => command === 'register_audit_queue_wakeup' ? new Promise<void>(resolve => { release = resolve; }) : Promise.resolve());
    const enable = syncAuditQueueWakeup('project-a', 'run-a', true); await flushMicrotasks();
    const disable = syncAuditQueueWakeup('project-a', 'run-a', false); await flushMicrotasks();
    expect(commands()).toEqual(['register_audit_queue_wakeup']); release(); await Promise.all([enable, disable]);
    expect(commands()).toEqual(['register_audit_queue_wakeup', 'unregister_audit_queue_wakeup']);
  });

  it('preserves a failed write for its caller and allows a newer cancellation', async () => {
    mocks.invokeTauriCommand.mockRejectedValueOnce(new Error('native scheduler unavailable')).mockResolvedValue(undefined);
    await expect(syncAuditQueueWakeup('project-a', 'run-a', true)).rejects.toThrow('native scheduler unavailable');
    await expect(syncAuditQueueWakeup('project-a', 'run-a', false)).resolves.toBeUndefined();
    expect(commands()).toEqual(['register_audit_queue_wakeup', 'unregister_audit_queue_wakeup']);
  });

  it('allows independent run identifiers to proceed without waiting for one blocked queue', async () => {
    let release!: () => void;
    mocks.invokeTauriCommand.mockImplementation((_command, args) => args.runId === 'blocked' ? new Promise<void>(resolve => { release = resolve; }) : Promise.resolve());
    const blocked = syncAuditQueueWakeup('project-a', 'blocked', true); await flushMicrotasks();
    await syncAuditQueueWakeup('project-a', 'independent', false);
    expect(mocks.invokeTauriCommand.mock.calls.map(([,args]) => args.runId)).toEqual(['blocked', 'independent']);
    release(); await blocked;
  });

  const handoff = (overrides: Partial<ScheduledExecutionHandoff> = {}): ScheduledExecutionHandoff => ({
    projectId: 'project-a', scheduleId: loadScheduledAudits('project-a')[0]?.id || 'schedule-race', taskType: 'page-audit', startedAt: '2026-10-01T08:00:00Z',
    completedAt: '2026-10-01T08:01:00Z', succeeded: true, nextRunAt: '2026-10-02T08:00:00Z', ...overrides,
  });

  it('mirrors only known project handoffs and leaves acknowledgment to the result consumer', async () => {
    addScheduledAudit('project-a', 'https://example.com/', 24);
    const valid = handoff(); mocks.invokeTauriCommand.mockResolvedValue([handoff({projectId:'other-project'}), handoff({scheduleId:'missing'}), valid]);
    await expect(reconcileScheduledExecutions('project-a')).resolves.toEqual([valid]);
    expect(mocks.invokeTauriCommand).toHaveBeenCalledExactlyOnceWith('list_scheduled_executions', { projectId: 'project-a' });
    expect(loadScheduledAudits('project-a')[0]).toMatchObject({status:'completed',lastStartedAt:valid.startedAt,lastRunAt:valid.completedAt,nextRunAt:valid.nextRunAt});
    expect(loadScheduledAudits('project-a')[0].runHistory).toHaveLength(1);
    await reconcileScheduledExecutions('project-a');
    expect(loadScheduledAudits('project-a')[0].runHistory).toHaveLength(1);
  });

  it('preserves failed execution evidence and paused state of a disabled schedule', async () => {
    const created = addScheduledAudit('project-a', 'https://example.com/', 24);
    setScheduledAuditEnabled('project-a', created.id, false);
    mocks.invokeTauriCommand.mockResolvedValue([handoff({succeeded:false,error:'actual native failure'})]);
    await reconcileScheduledExecutions('project-a');
    expect(loadScheduledAudits('project-a')[0]).toMatchObject({status:'paused',lastError:'actual native failure',runHistory:[expect.objectContaining({succeeded:false,error:'actual native failure'})]});
  });

  it('propagates native list failure without changing the project mirror', async () => {
    addScheduledAudit('project-a', 'https://example.com/', 24); const before = loadScheduledAudits('project-a');
    mocks.invokeTauriCommand.mockRejectedValue(new Error('handoff storage locked'));
    await expect(reconcileScheduledExecutions('project-a')).rejects.toThrow('handoff storage locked');
    expect(loadScheduledAudits('project-a')).toEqual(before);
  });
});
