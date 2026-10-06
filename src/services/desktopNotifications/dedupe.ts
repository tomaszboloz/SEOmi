import { writeStorageResult } from '@/services/storage';
import { validProjectId } from '@/services/schedules/policy';

export type CompletionNotificationType = 'audit' | 'crawl' | 'batch';
export const COMPLETION_NOTIFICATION_HISTORY_LIMIT = 64;
const storageSuffix = 'completion_notifications_v1';
const pending = new Set<string>();

export interface CompletionNotificationRecord { fingerprint: string; sentAt: string }
export interface CompletionNotificationReservation {
  fingerprint: string;
  duplicate: boolean;
  storageError: boolean;
  finish: (sent: boolean) => boolean;
}

const storageKey = (projectId: string) => `seomi_project_${projectId}_${storageSuffix}`;
const isRecord = (value: unknown): value is CompletionNotificationRecord => Boolean(value)
  && typeof value === 'object'
  && typeof (value as CompletionNotificationRecord).fingerprint === 'string'
  && typeof (value as CompletionNotificationRecord).sentAt === 'string';
const readHistory = (projectId: string): { records: CompletionNotificationRecord[]; error: boolean } => {
  try {
    if (typeof localStorage === 'undefined') return { records: [], error: true };
    const raw = localStorage.getItem(storageKey(projectId));
    if (raw === null) return { records: [], error: false };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { records: [], error: true };
    return { records: parsed.filter(isRecord), error: parsed.some((value) => !isRecord(value)) };
  } catch { return { records: [], error: true }; }
};

export const completionNotificationFingerprint = (
  projectId: string,
  runId: string,
  type: CompletionNotificationType,
): string | null => {
  if (!validProjectId(projectId) || !runId.trim()) return null;
  return [projectId, runId.trim(), type].map((value) => encodeURIComponent(value)).join('|');
};

export const reserveCompletionNotification = (
  projectId: string,
  runId: string,
  type: CompletionNotificationType,
): CompletionNotificationReservation | null => {
  const fingerprint = completionNotificationFingerprint(projectId, runId, type);
  if (!fingerprint) return null;
  if (pending.has(fingerprint)) return { fingerprint, duplicate: true, storageError: false, finish: () => false };
  const history = readHistory(projectId);
  if (history.records.some((record) => record.fingerprint === fingerprint)) {
    return { fingerprint, duplicate: true, storageError: history.error, finish: () => false };
  }
  pending.add(fingerprint);
  return {
    fingerprint,
    duplicate: false,
    storageError: history.error,
    finish: (sent) => {
      pending.delete(fingerprint);
      if (!sent) return false;
      const current = readHistory(projectId);
      if (current.error) return false;
      if (current.records.some((record) => record.fingerprint === fingerprint)) return true;
      const records = [...current.records, { fingerprint, sentAt: new Date().toISOString() }]
        .slice(-COMPLETION_NOTIFICATION_HISTORY_LIMIT);
      return writeStorageResult(storageKey(projectId), JSON.stringify(records)).ok;
    },
  };
};
