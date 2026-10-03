import { isTauriEnvironment } from '@/services/tauri';
import { areAuditNotificationsEnabled } from './preferences';

export interface ProjectNotification { title: string; body: string }
/** Recheck opt-in after native permission awaits so an in-flight operation honors opt-out. */
export const sendProjectNotification = async (projectId: string, build: () => ProjectNotification): Promise<boolean> => {
  if (!areAuditNotificationsEnabled(projectId) || !isTauriEnvironment()) return false;
  try {
    const notifications = await import('@tauri-apps/plugin-notification');
    if (!(await notifications.isPermissionGranted())) return false;
    if (!areAuditNotificationsEnabled(projectId) || !isTauriEnvironment()) return false;
    notifications.sendNotification(build());
    return true;
  } catch {
    // Notifications are best-effort and must never hide a completed audit.
    return false;
  }
};
