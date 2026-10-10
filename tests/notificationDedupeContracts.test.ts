import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification';
import { notifyAuditCompleted, notifyCrawlCompleted, notifyBatchCompleted } from '@/services/desktopNotifications';
import { COMPLETION_NOTIFICATION_HISTORY_LIMIT } from '@/services/desktopNotifications/dedupe';
import { notificationAudit, notificationCrawl } from './fixtures/notifications';

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(), requestPermission: vi.fn(), sendNotification: vi.fn(),
}));
const key = 'seomi_project_project-a_completion_notifications_v1';
const summary = (runId: string) => ({ completed: 1, failed: 0, queued: 0, regressionCount: 0, stopped: false, runId });

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  vi.mocked(isPermissionGranted).mockResolvedValue(true);
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  localStorage.setItem('seomi_project_project-a_desktop_notifications_v1', 'true');
});
afterEach(() => { vi.restoreAllMocks(); delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; });

it('persists one fingerprint per project, run and completion type', async () => {
  const audit = notificationAudit(80);
  await notifyAuditCompleted('project-a', audit, undefined, { runId: 'run-1' });
  await notifyAuditCompleted('project-a', audit, undefined, { runId: 'run-1' });
  await notifyCrawlCompleted('project-a', notificationCrawl(80), undefined, { runId: 'run-1' });
  await notifyBatchCompleted('project-a', summary('run-1'));
  expect(sendNotification).toHaveBeenCalledTimes(3);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(expect.arrayContaining([
    expect.objectContaining({ fingerprint: 'project-a|run-1|audit' }),
    expect.objectContaining({ fingerprint: 'project-a|run-1|crawl' }),
    expect.objectContaining({ fingerprint: 'project-a|run-1|batch' }),
  ]));
});

it('retains only the newest bounded completion fingerprints', async () => {
  for (let index = 0; index < COMPLETION_NOTIFICATION_HISTORY_LIMIT + 2; index += 1) {
    await notifyBatchCompleted('project-a', summary(`run-${index}`));
  }
  expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(COMPLETION_NOTIFICATION_HISTORY_LIMIT);
  await notifyBatchCompleted('project-a', summary('run-0'));
  expect(sendNotification).toHaveBeenCalledTimes(COMPLETION_NOTIFICATION_HISTORY_LIMIT + 3);
  await notifyBatchCompleted('project-a', summary(`run-${COMPLETION_NOTIFICATION_HISTORY_LIMIT + 1}`));
  expect(sendNotification).toHaveBeenCalledTimes(COMPLETION_NOTIFICATION_HISTORY_LIMIT + 3);
});

it('suppresses concurrent duplicates before the native permission check resolves', async () => {
  let grant!: (value: boolean) => void;
  vi.mocked(isPermissionGranted).mockReturnValue(new Promise(resolve => { grant = resolve; }));
  const audit = notificationAudit(80);
  const first = notifyAuditCompleted('project-a', audit, undefined, { runId: 'race' });
  await vi.waitFor(() => expect(isPermissionGranted).toHaveBeenCalledOnce());
  const second = notifyAuditCompleted('project-a', audit, undefined, { runId: 'race' });
  grant(true);
  await Promise.all([first, second]);
  expect(sendNotification).toHaveBeenCalledOnce();
});

it('sends again and leaves the history unchanged when storage cannot be read or written', async () => {
  localStorage.setItem(key, '{broken');
  const audit = notificationAudit(80);
  await notifyAuditCompleted('project-a', audit, undefined, { runId: 'broken' });
  await notifyAuditCompleted('project-a', audit, undefined, { runId: 'broken' });
  expect(sendNotification).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem(key)).toBe('{broken');

  localStorage.removeItem(key);
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((name) => {
    if (name === key) throw new Error('quota');
  });
  await notifyCrawlCompleted('project-a', notificationCrawl(80), undefined, { runId: 'quota' });
  await notifyCrawlCompleted('project-a', notificationCrawl(80), undefined, { runId: 'quota' });
  expect(sendNotification).toHaveBeenCalledTimes(4);
  expect(setItem).toHaveBeenCalled();
});

it('does not record an opt-out delivery and can retry after permission is granted', async () => {
  vi.mocked(isPermissionGranted).mockResolvedValueOnce(false).mockResolvedValue(true);
  await notifyBatchCompleted('project-a', summary('permission'));
  expect(sendNotification).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
  await notifyBatchCompleted('project-a', summary('permission'));
  expect(sendNotification).toHaveBeenCalledOnce();
  expect(localStorage.getItem(key)).toContain('project-a|permission|batch');
});
