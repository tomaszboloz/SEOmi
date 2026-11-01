import { isDelivered, markDelivered } from '@/services/schedules/deliveries';
import { applyScheduledExecution, type ScheduledAudit, type ScheduledExecutionHandoff } from '@/services/auditSchedule';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';

export interface ScheduledLaunchContext {
  projectId: string | null;
  scheduleId: string | null;
  headless: boolean;
}

const scheduleWakeupWrites = new Map<string, Promise<void>>();

/**
 * Serialize native writes for one project/schedule pair. The desktop
 * scheduler has two persisted representations (the task manifest and the OS
 * wake-up), so an enable/update followed immediately by disable/remove must
 * finish in invocation order. Each caller still receives its own rejection,
 * while a failed older write cannot poison the queue for the newer request.
 */
const enqueueScheduleWakeup = (projectId: string, scheduleId: string, operation: () => Promise<void>): Promise<void> => {
  const key = `${projectId}:${scheduleId}`;
  const previous = scheduleWakeupWrites.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  scheduleWakeupWrites.set(key, next);
  return next.finally(() => {
    if (scheduleWakeupWrites.get(key) === next) scheduleWakeupWrites.delete(key);
  });
};

/**
 * Register only an opaque project/schedule identifier with the OS scheduler.
 * URLs, credentials and crawl configuration never leave the project store.
 * The native desktop worker validates due time again before executing a task,
 * including when the foreground SPA is closed.
 */
export const syncAuditWakeup = async (projectId: string, schedule?: ScheduledAudit): Promise<void> => {
  if (!isTauriEnvironment()) return;
  if (!schedule || !schedule.enabled) {
    if (schedule) {
      await enqueueScheduleWakeup(projectId, schedule.id, async () => {
        await invokeTauriCommand('delete_scheduled_task', { projectId, scheduleId: schedule.id });
        await invokeTauriCommand('unregister_audit_wakeup', { projectId, scheduleId: schedule.id });
      });
    }
    return;
  }
  await enqueueScheduleWakeup(projectId, schedule.id, async () => {
    await invokeTauriCommand('save_scheduled_task', {
      projectId,
      task: {
        scheduleId: schedule.id,
        url: schedule.url,
        taskType: schedule.taskType || 'page-audit',
        crawlLimit: schedule.crawlLimit,
        crawlConfig: schedule.crawlConfig,
        intervalHours: schedule.intervalHours,
        enabled: schedule.enabled,
        status: schedule.status,
        createdAt: schedule.createdAt,
        nextRunAt: schedule.nextRunAt,
        lastStartedAt: schedule.lastStartedAt,
        lastRunAt: schedule.lastRunAt,
        lastError: schedule.lastError,
        runHistory: schedule.runHistory || [],
      },
    });
    await invokeTauriCommand('register_audit_wakeup', {
      projectId,
      scheduleId: schedule.id,
      nextRunAt: schedule.nextRunAt,
      intervalHours: schedule.intervalHours,
    });
  });
};

export const removeAuditWakeup = async (projectId: string, scheduleId: string): Promise<void> => {
  if (!isTauriEnvironment()) return;
  await enqueueScheduleWakeup(projectId, scheduleId, async () => {
    await invokeTauriCommand('delete_scheduled_task', { projectId, scheduleId });
    await invokeTauriCommand('unregister_audit_wakeup', { projectId, scheduleId });
  });
};

const queueWakeupWrites = new Map<string, Promise<void>>();

/**
 * Arm a one-shot native wake-up for a CSV audit queue. The worker deliberately
 * waits ten minutes and verifies that the persisted run is stale before doing
 * any network work; an open foreground queue therefore remains authoritative,
 * while a closed app can resume a run that was interrupted.
 */
export const syncAuditQueueWakeup = async (
  projectId: string,
  runId: string | null,
  enabled: boolean,
): Promise<void> => {
  if (!isTauriEnvironment() || !runId) return;
  const key = `${projectId}:${runId}`;
  const previous = queueWakeupWrites.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    if (!enabled) {
      await invokeTauriCommand('unregister_audit_queue_wakeup', { projectId, runId });
      return;
    }
    const nextRunAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await invokeTauriCommand('register_audit_queue_wakeup', { projectId, runId, nextRunAt });
  });
  queueWakeupWrites.set(key, next);
  try {
    await next;
  } finally {
    if (queueWakeupWrites.get(key) === next) queueWakeupWrites.delete(key);
  }
};

export const getScheduledLaunchContext = async (): Promise<ScheduledLaunchContext> => {
  if (!isTauriEnvironment()) return { projectId: null, scheduleId: null, headless: false };
  return invokeTauriCommand<ScheduledLaunchContext>('scheduled_launch_context');
};

/**
 * Reconcile a result produced while the SPA was closed. The native handoff is
 * acknowledged only after the local project mirror has been updated, so a
 * locked WebView cannot silently lose a completed scheduled run.
 */
export const reconcileScheduledExecutions = async (projectId: string): Promise<ScheduledExecutionHandoff[]> => {
  if (!isTauriEnvironment()) return [];
  const handoffs = await invokeTauriCommand<ScheduledExecutionHandoff[]>('list_scheduled_executions', { projectId });
  const reconciled: ScheduledExecutionHandoff[] = [];
  for (const handoff of handoffs) {
    if (isDelivered(projectId, handoff)) continue;
    const schedule = applyScheduledExecution(projectId, handoff);
    if (!schedule) continue;
    markDelivered(projectId, handoff);
    reconciled.push(handoff);
  }
  return reconciled;
};

export const acknowledgeScheduledExecution = async (projectId: string, scheduleId: string): Promise<void> => {
  if (!isTauriEnvironment()) return;
  await invokeTauriCommand('acknowledge_scheduled_execution', { projectId, scheduleId });
};
