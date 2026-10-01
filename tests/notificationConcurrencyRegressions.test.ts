import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { notifyScheduledAuditReminder, notifyAuditCompleted, notifyCrawlCompleted, notifyBatchCompleted, disableAuditNotifications, enableAuditNotifications, areAuditNotificationsEnabled } from '@/services/desktopNotifications';
import { addScheduledAudit } from '@/services/auditSchedule';
vi.mock('@tauri-apps/plugin-notification', () => ({ isPermissionGranted: vi.fn(), requestPermission: vi.fn(), sendNotification: vi.fn() }));
const now = Date.UTC(2026, 9, 1, 10);
beforeEach(() => {
  localStorage.clear(); vi.resetAllMocks();
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  localStorage.setItem('seomi_project_project-a_desktop_notifications_v1', 'true');
});
afterEach(() => { delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; });
const pendingPermission = () => {
  let resolve!: (value: boolean) => void;
  vi.mocked(isPermissionGranted).mockReturnValue(new Promise<boolean>(done => { resolve = done; }));
  return { grant: () => resolve(true), started: async () => { await vi.waitFor(() => expect(isPermissionGranted).toHaveBeenCalled()); } };
};
it('sends one reminder when scheduler ticks overlap during the native permission check', async () => {
  addScheduledAudit('project-a', 'https://example.test/', 6, now - 5.5 * 3600000);
  const pending = pendingPermission();
  const first = notifyScheduledAuditReminder('project-a', now);
  await pending.started();
  const second = notifyScheduledAuditReminder('project-a', now);
  await vi.dynamicImportSettled(); pending.grant(); await Promise.all([first, second]);
  expect(sendNotification).toHaveBeenCalledOnce();
});
it.each(['reminder', 'audit', 'crawl', 'batch'])('honors an opt-out made during an in-flight %s permission check', async kind => {
  addScheduledAudit('project-a', 'https://example.test/', 6, now - 5.5 * 3600000);
  const pending = pendingPermission();
  const operation = kind === 'reminder' ? notifyScheduledAuditReminder('project-a', now)
    : kind === 'audit' ? notifyAuditCompleted('project-a', { final_url: 'https://example.test/', health_score: 80 } as never)
    : kind === 'crawl' ? notifyCrawlCompleted('project-a', { start_url: 'https://example.test/', health_score: 80, pages_crawled: 3 } as never)
    : notifyBatchCompleted('project-a', { completed: 1, failed: 0, queued: 0, regressionCount: 0, stopped: false });
  await pending.started(); disableAuditNotifications('project-a'); pending.grant(); await operation;
  expect(sendNotification).not.toHaveBeenCalled();
  expect(localStorage.getItem('seomi_project_project-a_audit_reminders_v1')).toBeNull();
});

it('does not persist an opt-in after the user disables notifications during its permission request', async () => {
  disableAuditNotifications('project-a');
  vi.mocked(isPermissionGranted).mockResolvedValue(false);
  let grant!: (value: 'granted') => void;
  vi.mocked(requestPermission).mockReturnValue(new Promise(resolve => { grant = resolve; }));
  const operation = enableAuditNotifications('project-a');
  await vi.waitFor(() => expect(requestPermission).toHaveBeenCalled());
  disableAuditNotifications('project-a'); grant('granted');
  expect(await operation).toBe(false); expect(areAuditNotificationsEnabled('project-a')).toBe(false);
});
