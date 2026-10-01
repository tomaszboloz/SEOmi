import i18n from '@/i18n';
import { loadScheduledAudits, saveScheduledAudits } from './persistence';
import type { ScheduledAudit, ScheduledExecutionHandoff } from './types';
import { validProjectId } from './policy';

/** Apply a native headless execution to the project-local schedule mirror. */
export const applyScheduledExecution = (projectId: string, handoff: ScheduledExecutionHandoff): ScheduledAudit | null => {
  if (handoff.projectId !== projectId || !validProjectId(projectId)) return null;
  const schedules = loadScheduledAudits(projectId);
  const index = schedules.findIndex((schedule) => schedule.id === handoff.scheduleId);
  if (index < 0) return null;
  const schedule = schedules[index];
  const history = schedule.runHistory || [];
  const alreadyRecorded = history.some((entry) => (
    entry.startedAt === handoff.startedAt && entry.completedAt === handoff.completedAt
  ));
  const next: ScheduledAudit = {
    ...schedule,
    status: schedule.enabled ? (handoff.succeeded ? 'completed' : 'failed') : 'paused',
    lastStartedAt: handoff.startedAt,
    lastRunAt: handoff.completedAt,
    nextRunAt: handoff.nextRunAt,
    lastError: handoff.succeeded
      ? handoff.schedulerError
      : handoff.error || i18n.t('runtimeErrors.schedules.auditFailed'),
    runHistory: alreadyRecorded
      ? history
      : [
        ...history,
        {
          startedAt: handoff.startedAt,
          completedAt: handoff.completedAt,
          succeeded: handoff.succeeded,
          ...(handoff.succeeded ? {} : { error: handoff.error || i18n.t('runtimeErrors.schedules.auditFailed') }),
        },
      ].slice(-20),
  };
  schedules[index] = next;
  saveScheduledAudits(projectId, schedules);
  return next;
};

