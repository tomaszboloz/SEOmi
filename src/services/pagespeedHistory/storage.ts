import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { createId } from '@/services/ids';

import { PageSpeedSnapshot, PageSpeedSnapshotInput } from "./contracts";
import { normalizePageSpeedSnapshots } from "./normalization";

export const storageKey = (projectId: string) => `seomi_project_${projectId}_pagespeed_history_v1`;

export const readPageSpeedSnapshots = (projectId: string | null): PageSpeedSnapshot[] => {
  if (!projectId) return [];
  return normalizePageSpeedSnapshots(readJsonStorage(storageKey(projectId), []));
};

export const makeSnapshotId = (_capturedAt: string) => createId('pagespeed');

export const createPageSpeedSnapshot = (input: PageSpeedSnapshotInput): PageSpeedSnapshot => {
  const capturedAt = input.capturedAt || new Date().toISOString();
  return {
    id: makeSnapshotId(capturedAt),
    capturedAt,
    url: input.url.trim(),
    strategy: input.strategy,
    formFactor: input.formFactor,
    scope: input.scope,
    pageSpeed: input.pageSpeed || null,
    crux: input.crux || null,
  };
};

export const savePageSpeedSnapshot = (projectId: string | null, snapshot: PageSpeedSnapshot, existing?: PageSpeedSnapshot[]): PageSpeedSnapshot[] => {
  if (!projectId) return existing || [];
  const next = normalizePageSpeedSnapshots([snapshot, ...(existing || readPageSpeedSnapshots(projectId))]);
  writeJsonStorage(storageKey(projectId), next);
  return next;
};

export const clearPageSpeedSnapshots = (projectId: string | null): void => {
  if (!projectId) return;
  writeJsonStorage(storageKey(projectId), []);
};

export const pageSpeedHistoryStorageKey = storageKey;
