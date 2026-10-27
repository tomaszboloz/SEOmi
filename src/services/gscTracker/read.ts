import { readStorage } from '@/services/storage';
import { gscSnapshotSchema } from './schema';
import { gscSnapshotStorageKey, MAX_GSC_SNAPSHOTS_PER_PROJECT } from './limits';
import type { GscPerformanceSnapshot } from './types';

/** Saved snapshots of a project; invalid entries are dropped. Kept free of UI-string imports so services can use it. */
export const readGscSnapshots = (projectId: string, storage: Pick<Storage, 'getItem'> = { getItem: readStorage }): GscPerformanceSnapshot[] => {
  try {
    const value = JSON.parse(storage.getItem(gscSnapshotStorageKey(projectId)) || '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
      const result = gscSnapshotSchema.safeParse(item);
      return result.success ? [result.data] : [];
    })
      .slice(0, MAX_GSC_SNAPSHOTS_PER_PROJECT);
  } catch {
    return [];
  }
};
