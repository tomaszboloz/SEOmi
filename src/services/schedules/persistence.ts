import { readStorage, writeStorage } from '@/services/storage';
import i18n from '@/i18n';
import type { ScheduledAudit } from './types';
import { parseSchedules, validProjectId, MAX_SCHEDULES_PER_PROJECT } from './policy';
const storageKey = (projectId:string) => `seomi_project_${projectId}_audit_schedules_v1`;
export const AUDIT_SCHEDULES_UPDATED_EVENT = 'seomi:audit-schedules-updated';

export const loadScheduledAudits = (projectId: string): ScheduledAudit[] => {
  if (!validProjectId(projectId)) return [];
  try {
    return parseSchedules(JSON.parse(readStorage(storageKey(projectId)) || '[]'));
  } catch {
    return [];
  }
};

export const saveScheduledAudits = (projectId: string, schedules: ScheduledAudit[]): void => {
  if (!validProjectId(projectId)) throw new Error(i18n.t('runtimeErrors.schedules.projectRequired'));
  if (!writeStorage(storageKey(projectId), JSON.stringify(schedules.slice(0, MAX_SCHEDULES_PER_PROJECT)))) {
    throw new Error(i18n.t('runtimeErrors.schedules.saveFailed'));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUDIT_SCHEDULES_UPDATED_EVENT, { detail: { projectId } }));
  }
};

