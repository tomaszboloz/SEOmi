import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { sendProjectNotification } from '@/services/desktopNotifications/delivery';
import { enableAuditNotifications, disableAuditNotifications, areAuditNotificationsEnabled, notifyAuditCompleted, notifyCrawlCompleted, notifyBatchCompleted, notifyScheduledAuditReminder } from '@/services/desktopNotifications';
import { addScheduledAudit } from '@/services/auditSchedule';
import { saveScheduledAudits } from '@/services/schedules/persistence';
import { notificationAudit, notificationCrawl } from './fixtures/notifications';
import i18n from '@/i18n';
vi.mock('@tauri-apps/plugin-notification', () => ({ isPermissionGranted: vi.fn(), requestPermission: vi.fn(), sendNotification: vi.fn() }));
const now = Date.UTC(2026, 9, 1, 10);
beforeEach(() => {
  localStorage.clear(); vi.resetAllMocks();
  vi.mocked(isPermissionGranted).mockResolvedValue(true); vi.mocked(requestPermission).mockResolvedValue('granted');
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  localStorage.setItem('seomi_project_project-a_desktop_notifications_v1', 'true');
});
afterEach(() => { vi.restoreAllMocks(); delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; });
it('directly sends a local payload only with opt-in, native environment and permission', async () => {
  const build = vi.fn(() => ({ title: 'Observed', body: 'Local only' }));
  expect(await sendProjectNotification('project-a', build)).toBe(true);
  expect(sendNotification).toHaveBeenCalledExactlyOnceWith({ title: 'Observed', body: 'Local only' });
  expect(await sendProjectNotification('project-b', build)).toBe(false);
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  expect(await sendProjectNotification('project-a', build)).toBe(false); expect(build).toHaveBeenCalledOnce();
});
it('does not build a payload when permission is denied and safely handles native failures', async () => {
  const build = vi.fn(() => ({ title: 'Observed', body: 'Local' }));
  vi.mocked(isPermissionGranted).mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('native unavailable'));
  expect(await sendProjectNotification('project-a', build)).toBe(false);
  expect(await sendProjectNotification('project-a', build)).toBe(false); expect(build).not.toHaveBeenCalled();
  vi.mocked(sendNotification).mockImplementationOnce(() => { throw new Error('send failed'); });
  expect(await sendProjectNotification('project-a', build)).toBe(false);
});
it('rechecks the native environment after a permission wait', async () => {
  let grant!: (value: boolean) => void;
  vi.mocked(isPermissionGranted).mockReturnValue(new Promise(resolve => { grant = resolve; }));
  const operation = sendProjectNotification('project-a', () => ({ title: 'Observed', body: 'Local' }));
  await vi.waitFor(() => expect(isPermissionGranted).toHaveBeenCalled());
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; grant(true);
  expect(await operation).toBe(false); expect(sendNotification).not.toHaveBeenCalled();
});
it('rejects invalid project preferences, browser opt-ins and failed preference writes', async () => {
  expect(areAuditNotificationsEnabled('../foreign')).toBe(false); disableAuditNotifications('../foreign');
  expect(await enableAuditNotifications('../foreign')).toBe(false);
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  expect(await enableAuditNotifications('project-a')).toBe(false);
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  disableAuditNotifications('project-a');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(await enableAuditNotifications('project-a')).toBe(false); expect(areAuditNotificationsEnabled('project-a')).toBe(false);
});
it('does not request permission again when already granted, and handles rejected permission probes', async () => {
  expect(await enableAuditNotifications('project-a')).toBe(true); expect(requestPermission).not.toHaveBeenCalled();
  vi.mocked(isPermissionGranted).mockRejectedValueOnce(new Error('native unavailable'));
  expect(await enableAuditNotifications('project-b')).toBe(false); expect(areAuditNotificationsEnabled('project-b')).toBe(false);
});
it('honors a native environment change while opt-in is pending', async () => {
  disableAuditNotifications('project-a');
  let grant!: (value: boolean) => void;
  vi.mocked(isPermissionGranted).mockReturnValue(new Promise(resolve => { grant = resolve; }));
  const operation = enableAuditNotifications('project-a'); await vi.waitFor(() => expect(isPermissionGranted).toHaveBeenCalled());
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; grant(true);
  expect(await operation).toBe(false); expect(areAuditNotificationsEnabled('project-a')).toBe(false);
});
it('reports completion without regression when there is no lower score', async () => {
  await notifyAuditCompleted('project-a', notificationAudit(80));
  expect(sendNotification).toHaveBeenLastCalledWith({ title: i18n.t('runtimeErrors.desktop.auditComplete'), body: i18n.t('runtimeErrors.desktop.auditCompleteBody', { host: 'example.com', score: 80 }) });
  await notifyCrawlCompleted('project-a', notificationCrawl(80), notificationCrawl(80));
  expect(sendNotification).toHaveBeenLastCalledWith({ title: i18n.t('runtimeErrors.desktop.crawlCompleted'), body: i18n.t('runtimeErrors.desktop.crawlCompletedBody', { host: 'example.com', pages: 3, score: 80 }) });
  await notifyBatchCompleted('project-a', { completed: 1, failed: 0, queued: 0, regressionCount: 0, stopped: false });
  expect(sendNotification).toHaveBeenLastCalledWith({ title: i18n.t('runtimeErrors.desktop.queueCompleted'), body: i18n.t('runtimeErrors.desktop.queueBody', { completed: 1, failed: 0, pending: '', regression: '' }) });
});
it('does not let malformed observed URLs hide completion results', async () => {
  await expect(notifyAuditCompleted('project-a', { ...notificationAudit(80), final_url: 'invalid' })).resolves.toBeUndefined();
  await expect(notifyCrawlCompleted('project-a', { ...notificationCrawl(80), start_url: 'invalid' })).resolves.toBeUndefined();
  expect(sendNotification).not.toHaveBeenCalled();
});
it('selects the nearest enabled schedule and reports hours for a crawl reminder', async () => {
  const later = addScheduledAudit('project-a', 'https://later.test/', 6, now - 4 * 3600000);
  const nearest = addScheduledAudit('project-a', 'https://nearest.test/', 6, now - 5 * 3600000, { taskType: 'site-crawl' });
  expect(later.nextRunAt).not.toBe(nearest.nextRunAt);
  await notifyScheduledAuditReminder('project-a', now, 3 * 3600000);
  expect(sendNotification).toHaveBeenCalledExactlyOnceWith({ title: i18n.t('runtimeErrors.desktop.reminderTitle'), body: i18n.t('runtimeErrors.desktop.reminderBody', { task: i18n.t('runtimeErrors.desktop.taskCrawl'), host: 'nearest.test', delay: i18n.t('runtimeErrors.desktop.reminderInHours', { count: 1 }) }) });
});
it('ignores disabled, running, due and outside-window schedules and releases an empty selection lock', async () => {
  const record = addScheduledAudit('project-a', 'https://site.test/', 6, now);
  saveScheduledAudits('project-a', [
    { ...record, id: 'disabled', enabled: false, nextRunAt: new Date(now + 60000).toISOString() },
    { ...record, id: 'running', status: 'running', nextRunAt: new Date(now + 60000).toISOString() },
    { ...record, id: 'due', nextRunAt: new Date(now).toISOString() },
    { ...record, id: 'far', nextRunAt: new Date(now + 7200000).toISOString() },
  ]);
  await notifyScheduledAuditReminder('project-a', now); expect(sendNotification).not.toHaveBeenCalled();
  saveScheduledAudits('project-a', [{ ...record, nextRunAt: new Date(now + 1000).toISOString() }]);
  await notifyScheduledAuditReminder('project-a', now);
  expect(sendNotification).toHaveBeenLastCalledWith(expect.objectContaining({ body: i18n.t('runtimeErrors.desktop.reminderBody', { task: i18n.t('runtimeErrors.desktop.taskAudit'), host: 'site.test', delay: i18n.t('runtimeErrors.desktop.reminderInMinutes', { count: 1 }) }) }));
});
it('releases reminder locks after failed delivery and does not mark unsent reminders', async () => {
  addScheduledAudit('project-a', 'https://site.test/', 6, now - 5.5 * 3600000);
  vi.mocked(sendNotification).mockImplementationOnce(() => { throw new Error('native rejected'); });
  await notifyScheduledAuditReminder('project-a', now); expect(localStorage.getItem('seomi_project_project-a_audit_reminders_v1')).toBeNull();
  await notifyScheduledAuditReminder('project-a', now); expect(sendNotification).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem('seomi_project_project-a_audit_reminders_v1')).not.toBeNull();
});

it('skips reminders for invalid or disabled projects and browser previews', async () => {
  await notifyScheduledAuditReminder('../outside', now); await notifyScheduledAuditReminder('project-b', now);
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  await notifyScheduledAuditReminder('project-a', now);
  expect(isPermissionGranted).not.toHaveBeenCalled(); expect(sendNotification).not.toHaveBeenCalled();
});
it('does not recreate a reminder marker if opt-out occurs as delivery completes', async () => {
  addScheduledAudit('project-a', 'https://site.test/', 6, now - 5.5 * 3600000);
  vi.mocked(sendNotification).mockImplementationOnce(() => disableAuditNotifications('project-a'));
  await notifyScheduledAuditReminder('project-a', now);
  expect(sendNotification).toHaveBeenCalledOnce(); expect(localStorage.getItem('seomi_project_project-a_audit_reminders_v1')).toBeNull();
});
