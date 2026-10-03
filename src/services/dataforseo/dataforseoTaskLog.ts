import { readStorage, removeStorage, writeStorage } from '@/services/storage';
import { useProjectStore } from '@/stores/projectStore';
import { DataForSeoTaskMeta, DataForSeoTaskRecord } from './dataforseoTypes';

const DATAFORSEO_TASK_LOG_LIMIT = 100;
const dataForSeoTaskLogKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_task_log_v1`;

export const activeProjectForTaskLog = (): string | null => {
  try {
    const projectId = readStorage('seomi_active_project_v1') || useProjectStore.getState().activeProjectId || '';
    return /^[a-zA-Z0-9-]{1,80}$/.test(projectId) ? projectId : null;
  } catch {
    return null;
  }
};

export const readDataForSeoTaskLog = (projectId: string | null): DataForSeoTaskRecord[] => {
  if (!projectId) return [];
  try {
    const value: unknown = JSON.parse(readStorage(dataForSeoTaskLogKey(projectId)) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is DataForSeoTaskRecord => Boolean(
      item && typeof item === 'object' &&
      item.projectId === projectId && typeof item.endpoint === 'string' &&
      typeof item.requestedAt === 'string' && typeof item.completedAt === 'string' &&
      typeof item.ok === 'boolean',
    )).slice(0, DATAFORSEO_TASK_LOG_LIMIT);
  } catch {
    return [];
  }
};

export const clearDataForSeoTaskLog = (projectId: string | null): void => {
  if (!projectId) return;
  try {
    removeStorage(dataForSeoTaskLogKey(projectId));
  } catch {
    // Keep the live integration usable when storage is unavailable.
  }
};

export const appendDataForSeoTask = (meta: DataForSeoTaskMeta, projectId = activeProjectForTaskLog()): DataForSeoTaskRecord | null => {
  if (!projectId) return null;
  const record: DataForSeoTaskRecord = {
    ...meta,
    projectId,
    ok: meta.statusCode === 20000,
  };
  try {
    const next = [record, ...readDataForSeoTaskLog(projectId)].slice(0, DATAFORSEO_TASK_LOG_LIMIT);
    writeStorage(dataForSeoTaskLogKey(projectId), JSON.stringify(next));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('seomi:dataforseo-task'));
  } catch {
    // Do not make a paid request fail because the local history quota is full.
  }
  return record;
};
