import { validProjectId } from '@/services/schedules/policy';
import { isTauriEnvironment } from '@/services/tauri';
import { readStorage, removeStorage, writeStorage } from '@/services/storage';

const preferenceKey = (projectId: string) => `seomi_project_${projectId}_desktop_notifications_v1`;

const pendingOptIns = new Map<string, symbol>();

export const areAuditNotificationsEnabled = (projectId: string): boolean => {
  if (!validProjectId(projectId)) return false;
  return readStorage(preferenceKey(projectId)) === 'true';
};

export const disableAuditNotifications = (projectId: string): void => {
  if (!validProjectId(projectId)) return;
  pendingOptIns.delete(projectId);
  removeStorage(preferenceKey(projectId));
  removeStorage(`seomi_project_${projectId}_audit_reminders_v1`);
};

export const enableAuditNotifications = async (projectId: string): Promise<boolean> => {
  if (!validProjectId(projectId) || !isTauriEnvironment()) return false;
  const token = Symbol('opt-in');
  pendingOptIns.set(projectId, token);
  try {
    const notifications = await import('@tauri-apps/plugin-notification');
    let granted = await notifications.isPermissionGranted();
    if (!granted) granted = (await notifications.requestPermission()) === 'granted';
    if (!granted || pendingOptIns.get(projectId) !== token || !isTauriEnvironment()) return false;
    if (!writeStorage(preferenceKey(projectId), 'true')) return false;
    return true;
  } catch {
    return false;
  } finally {
    if (pendingOptIns.get(projectId) === token) pendingOptIns.delete(projectId);
  }
};

