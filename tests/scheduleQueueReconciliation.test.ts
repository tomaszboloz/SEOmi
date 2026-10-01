import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({invokeTauriCommand:vi.fn(),native:true}));
vi.mock('@/services/tauri',()=>({isTauriEnvironment:()=>mocks.native,invokeTauriCommand:mocks.invokeTauriCommand}));
import { syncAuditQueueWakeup, reconcileScheduledExecutions } from '@/services/scheduleWakeup';
import { loadScheduledAudits, addScheduledAudit, setScheduledAuditEnabled, type ScheduledExecutionHandoff } from '@/services/auditSchedule';
const commands = ():string[] => mocks.invokeTauriCommand.mock.calls.map(([command])=>command as string);
const flushMicrotasks = async () => {await Promise.resolve();await Promise.resolve();};

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
