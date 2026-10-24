import { readStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { offPageHistorySchema, type OffPageHistoryRecord } from './historySchema';

export const offPageHistoryKey = (projectId: string): string => `seomi_project_${projectId}_offpage_history_v1`;
const newest = (records: OffPageHistoryRecord[]): OffPageHistoryRecord[] => {
  const seen = new Set<string>();
  return [...records].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .filter((record) => {
      if (seen.has(record.id)) return false;
      seen.add(record.id);
      return true;
    }).slice(0, 10);
};

export const loadOffPageHistory = (projectId: string | null): OffPageHistoryRecord[] => {
  if (!projectId) return [];
  const key = offPageHistoryKey(projectId);
  const raw = readStorage(key);
  if (raw === null) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('Invalid history');
    const records = newest(data.flatMap((entry) => {
      const parsed = offPageHistorySchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    }));
    if (JSON.stringify(records) !== raw) writeJsonStorage(key, records);
    return records;
  } catch {
    removeStorage(key);
    return [];
  }
};

export const saveOffPageHistory = (projectId: string | null, record: OffPageHistoryRecord): boolean => {
  const parsed = offPageHistorySchema.safeParse(record);
  return !!projectId && parsed.success && writeJsonStorage(offPageHistoryKey(projectId),
    newest([parsed.data, ...loadOffPageHistory(projectId).filter((entry) => entry.id !== parsed.data.id)]));
};

export const deleteOffPageHistory = (projectId: string | null, id: string): boolean => !!projectId
  && writeJsonStorage(offPageHistoryKey(projectId), loadOffPageHistory(projectId).filter((record) => record.id !== id));

export const clearOffPageHistory = (projectId: string | null): boolean => !!projectId && removeStorage(offPageHistoryKey(projectId));
