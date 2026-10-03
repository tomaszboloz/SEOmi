import i18n from '@/i18n';
import { loadScheduledAudits, saveScheduledAudits } from './persistence';
import type { ScheduledAudit, ScheduledAuditStatus } from './types';
import { validProjectId } from './policy';
const RUNNING_STALE_AFTER_MS = 5 * 60 * 1000;
const inFlightProjects = new Set<string>();

export const claimDueScheduledAudit = (
  projectId: string,
  now = Date.now(),
  requestedScheduleId?: string,
): ScheduledAudit | null => {
  if (!validProjectId(projectId) || inFlightProjects.size > 0) return null;
  const schedules = loadScheduledAudits(projectId);
  const dueIndex = schedules.findIndex((schedule) => {
    if (requestedScheduleId && schedule.id !== requestedScheduleId) return false;
    if (!schedule.enabled) return false;
    const nextRun = Date.parse(schedule.nextRunAt);
    if (nextRun > now) return false;
    if (schedule.status !== 'running') return true;
    const startedAt = Date.parse(schedule.lastStartedAt || '');
    return !Number.isFinite(startedAt) || now - startedAt >= RUNNING_STALE_AFTER_MS;
  });
  if (dueIndex < 0) return null;
  const schedule = schedules[dueIndex];
  const running = { ...schedule, status: 'running' as const, lastStartedAt: new Date(now).toISOString(), lastError: undefined };
  schedules[dueIndex] = running;
  saveScheduledAudits(projectId, schedules);
  inFlightProjects.add(projectId);
  return running;
};

export const finishScheduledAudit = (projectId: string, id: string, succeeded: boolean, error?: string, now = Date.now()): ScheduledAudit[] => {
  inFlightProjects.delete(projectId);
  const schedules = loadScheduledAudits(projectId).map((schedule) => schedule.id !== id ? schedule : {
    ...schedule,
    status: (schedule.enabled ? succeeded ? 'completed' : 'failed' : 'paused') as ScheduledAuditStatus,
    lastRunAt: new Date(now).toISOString(),
    nextRunAt: new Date(now + schedule.intervalHours * 60 * 60 * 1000).toISOString(),
    lastError: succeeded ? undefined : error?.slice(0, 500) || i18n.t('runtimeErrors.schedules.auditFailed'),
    runHistory: [
      ...(schedule.runHistory || []),
      {
        startedAt: schedule.lastStartedAt || new Date(now).toISOString(),
        completedAt: new Date(now).toISOString(),
        succeeded,
        ...(succeeded ? {} : { error: error?.slice(0, 500) || i18n.t('runtimeErrors.schedules.auditFailed') }),
      },
    ].slice(-20),
  });
  saveScheduledAudits(projectId, schedules);
  return schedules;
};
