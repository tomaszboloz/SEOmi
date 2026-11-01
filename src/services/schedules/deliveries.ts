import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { validProjectId } from './policy';
import type { ScheduledExecutionHandoff } from './types';

/**
 * Native handoffs carry a delivery fingerprint (#98 GEM-98-06). A handoff already handled is skipped when the
 * native side lists it again, so a restart cannot dispatch the same scheduled run twice. Older handoffs without a
 * fingerprint are always handled.
 */
export const DELIVERY_HISTORY_LIMIT = 64;
const key = (projectId: string) => `seomi_project_${projectId}_schedule_deliveries_v1`;

const seen = (projectId: string): string[] => {
  const raw = readJsonStorage(key(projectId), [] as unknown);
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
};

export const isDelivered = (projectId: string, handoff: ScheduledExecutionHandoff): boolean =>
  !!handoff.fingerprint && validProjectId(projectId) && seen(projectId).includes(handoff.fingerprint);

export const markDelivered = (projectId: string, handoff: ScheduledExecutionHandoff): boolean => {
  if (!handoff.fingerprint || !validProjectId(projectId)) return false;
  const kept = [handoff.fingerprint, ...seen(projectId).filter((item) => item !== handoff.fingerprint)].slice(0, DELIVERY_HISTORY_LIMIT);
  return writeJsonStorage(key(projectId), kept);
};
