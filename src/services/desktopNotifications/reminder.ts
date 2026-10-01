import { z } from 'zod';
import { parseRecordEntries } from '@/services/storageContracts';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { loadScheduledAudits } from '@/services/auditSchedule';
import { validProjectId } from '@/services/schedules/policy';
import { isTauriEnvironment } from '@/services/tauri';
import { areAuditNotificationsEnabled } from './preferences';
import { sendProjectNotification } from './delivery';
import i18n from '@/i18n';
const reminderKey = (projectId: string) => `seomi_project_${projectId}_audit_reminders_v1`;
const reminderLocks = new Set<string>();

const formatReminderDelay = (milliseconds: number): string => {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  if (minutes < 60) return i18n.t('runtimeErrors.desktop.reminderInMinutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  return i18n.t('runtimeErrors.desktop.reminderInHours', { count: hours });
};

/**
 * Send one local reminder for the nearest schedule due within the next hour.
 * The marker is keyed by schedule id and nextRunAt, so editing or completing
 * a recurring schedule naturally permits the next reminder while repeated
 * scheduler ticks remain quiet.
 */
export const notifyScheduledAuditReminder = async (
  projectId: string,
  now = Date.now(),
  leadMs = 60 * 60 * 1000,
): Promise<void> => {
  if (!validProjectId(projectId) || !areAuditNotificationsEnabled(projectId) || !isTauriEnvironment()) return;
  if (reminderLocks.has(projectId)) return;
  reminderLocks.add(projectId);
  try {
    const candidates = loadScheduledAudits(projectId)
      .filter((schedule) => {
        const nextRun = Date.parse(schedule.nextRunAt);
        return schedule.enabled && schedule.status !== 'running' && Number.isFinite(nextRun)
          && nextRun > now && nextRun - now <= leadMs;
      })
      .sort((left, right) => Date.parse(left.nextRunAt) - Date.parse(right.nextRunAt));
    const schedule = candidates[0];
    if (!schedule) return;

    const markers = parseRecordEntries(readJsonStorage(reminderKey(projectId), {}), z.string());
    if (markers[schedule.id] === schedule.nextRunAt) return;
    const sent = await sendProjectNotification(projectId, () => {
      const host = new URL(schedule.url).hostname;
      const taskLabel = schedule.taskType === 'site-crawl' ? i18n.t('runtimeErrors.desktop.taskCrawl') : i18n.t('runtimeErrors.desktop.taskAudit');
      return {
        title: i18n.t('runtimeErrors.desktop.reminderTitle'),
        body: i18n.t('runtimeErrors.desktop.reminderBody', { task: taskLabel, host, delay: formatReminderDelay(Date.parse(schedule.nextRunAt) - now) }),
      };
    });
    if (sent && areAuditNotificationsEnabled(projectId)) writeJsonStorage(reminderKey(projectId), { ...markers, [schedule.id]: schedule.nextRunAt });
  } finally { reminderLocks.delete(projectId); }
};

