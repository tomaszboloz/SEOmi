import { z } from 'zod';
import { parseRecordEntries } from './storageContracts';
import type { PageAuditData, SiteCrawlResult } from '@/types';
import { isTauriEnvironment } from '@/services/tauri';
import { readJsonStorage, readStorage, removeStorage, writeJsonStorage, writeStorage } from '@/services/storage';
import { loadScheduledAudits } from '@/services/auditSchedule';
import i18n from '@/i18n';

const preferenceKey = (projectId: string) => `seomi_project_${projectId}_desktop_notifications_v1`;
const reminderKey = (projectId: string) => `seomi_project_${projectId}_audit_reminders_v1`;
const validProjectId = (projectId: string) => /^[a-zA-Z0-9-]{1,80}$/.test(projectId);

export const areAuditNotificationsEnabled = (projectId: string): boolean => {
  if (!validProjectId(projectId)) return false;
  return readStorage(preferenceKey(projectId)) === 'true';
};

export const disableAuditNotifications = (projectId: string): void => {
  if (!validProjectId(projectId)) return;
  removeStorage(preferenceKey(projectId));
  removeStorage(reminderKey(projectId));
};

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
  try {
    const notifications = await import('@tauri-apps/plugin-notification');
    if (!(await notifications.isPermissionGranted())) return;
    const host = new URL(schedule.url).hostname;
    const taskLabel = schedule.taskType === 'site-crawl' ? i18n.t('runtimeErrors.desktop.taskCrawl') : i18n.t('runtimeErrors.desktop.taskAudit');
    notifications.sendNotification({
      title: i18n.t('runtimeErrors.desktop.reminderTitle'),
      body: i18n.t('runtimeErrors.desktop.reminderBody', { task: taskLabel, host, delay: formatReminderDelay(Date.parse(schedule.nextRunAt) - now) }),
    });
    writeJsonStorage(reminderKey(projectId), { ...markers, [schedule.id]: schedule.nextRunAt });
  } catch {
    // Notification failures must never affect a scheduled audit.
  }
};

export const enableAuditNotifications = async (projectId: string): Promise<boolean> => {
  if (!validProjectId(projectId) || !isTauriEnvironment()) return false;
  try {
    const notifications = await import('@tauri-apps/plugin-notification');
    let granted = await notifications.isPermissionGranted();
    if (!granted) granted = (await notifications.requestPermission()) === 'granted';
    if (!granted) return false;
    if (!writeStorage(preferenceKey(projectId), 'true')) return false;
    return true;
  } catch {
    return false;
  }
};

export const notifyAuditCompleted = async (
  projectId: string,
  audit: PageAuditData,
  previousScore?: number,
): Promise<void> => {
  if (!areAuditNotificationsEnabled(projectId) || !isTauriEnvironment()) return;
  try {
    const notifications = await import('@tauri-apps/plugin-notification');
    if (!(await notifications.isPermissionGranted())) return;
    const regression = typeof previousScore === 'number' && audit.health_score < previousScore;
    const host = new URL(audit.final_url).hostname;
    const delta = regression ? previousScore - audit.health_score : 0;
    notifications.sendNotification({
      title: regression ? i18n.t('runtimeErrors.desktop.auditRegression') : i18n.t('runtimeErrors.desktop.auditComplete'),
      body: regression
        ? i18n.t('runtimeErrors.desktop.auditRegressionBody', { host, delta, previous: previousScore, current: audit.health_score })
        : i18n.t('runtimeErrors.desktop.auditCompleteBody', { host, score: audit.health_score }),
    });
  } catch {
    // Notification failures must never fail an audit or hide its result.
  }
};

export const notifyCrawlCompleted = async (
  projectId: string,
  crawl: SiteCrawlResult,
  previousHealthScore?: number,
): Promise<void> => {
  if (!areAuditNotificationsEnabled(projectId) || !isTauriEnvironment()) return;
  try {
    const notifications = await import('@tauri-apps/plugin-notification');
    if (!(await notifications.isPermissionGranted())) return;
    const regression = typeof previousHealthScore === 'number' && crawl.health_score < previousHealthScore;
    const host = new URL(crawl.start_url).hostname;
    const delta = regression ? previousHealthScore - crawl.health_score : 0;
    notifications.sendNotification({
      title: regression ? i18n.t('runtimeErrors.desktop.crawlRegression') : i18n.t('runtimeErrors.desktop.crawlCompleted'),
      body: regression
        ? i18n.t('runtimeErrors.desktop.crawlRegressionBody', { host, delta, previous: previousHealthScore, current: crawl.health_score, pages: crawl.pages_crawled })
        : i18n.t('runtimeErrors.desktop.crawlCompletedBody', { host, pages: crawl.pages_crawled, score: crawl.health_score }),
    });
  } catch {
    // Notification failures must never fail a scheduled crawl.
  }
};

export interface BatchAuditNotificationSummary {
  completed: number;
  failed: number;
  queued: number;
  regressionCount: number;
  stopped: boolean;
}

/**
 * Batch runs intentionally produce one bounded local notification instead of
 * one notification per URL. The summary contains no page URL or audit body.
 */
export const notifyBatchCompleted = async (
  projectId: string,
  summary: BatchAuditNotificationSummary,
): Promise<void> => {
  if (!areAuditNotificationsEnabled(projectId) || !isTauriEnvironment()) return;
  try {
    const notifications = await import('@tauri-apps/plugin-notification');
    if (!(await notifications.isPermissionGranted())) return;
    const title = summary.stopped
      ? i18n.t('runtimeErrors.desktop.queueStopped')
      : i18n.t('runtimeErrors.desktop.queueCompleted');
    const regression = summary.regressionCount > 0
      ? i18n.t('runtimeErrors.desktop.regressions', { count: summary.regressionCount })
      : '';
    const pending = summary.queued > 0 ? i18n.t('runtimeErrors.desktop.pending', { count: summary.queued }) : '';
    notifications.sendNotification({
      title,
      body: i18n.t('runtimeErrors.desktop.queueBody', { completed: summary.completed, failed: summary.failed, pending, regression }),
    });
  } catch {
    // Notification failures must never fail a batch or hide its result.
  }
};
