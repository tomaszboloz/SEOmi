import i18n from '@/i18n';
import { readStorage, writeStorage } from '@/services/storage';
import type { StorageLike, TopicalMapDocument } from './types';
import { normalizeTopicalMap } from './normalization';
import { createEmptyTopicalMap } from './factories';
export const topicalMapStorageKey = (projectId: string) => `seomi_project_${projectId}_topical_map_v1`;
const browserStorage: StorageLike = {
  getItem: readStorage,
  setItem: (key, value) => {
    if (!writeStorage(key, value)) throw new Error(i18n.t('runtimeErrors.topical.workspaceUnavailable'));
  },
};

export const readTopicalMap = (projectId: string, storage: StorageLike = browserStorage): TopicalMapDocument => {
  try {
    const raw = storage.getItem(topicalMapStorageKey(projectId));
    return raw ? normalizeTopicalMap(JSON.parse(raw)) : createEmptyTopicalMap();
  } catch { return createEmptyTopicalMap(); }
};

export const writeTopicalMap = (projectId: string, document: TopicalMapDocument, storage: StorageLike = browserStorage): TopicalMapDocument => {
  const normalized = normalizeTopicalMap({ ...document, updatedAt: new Date().toISOString() });
  storage.setItem(topicalMapStorageKey(projectId), JSON.stringify(normalized));
  return normalized;
};
