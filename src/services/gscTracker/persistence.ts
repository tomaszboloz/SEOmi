import type { GscPerformanceData } from '@/types';
import type { GscPerformanceSnapshot } from './types';
import i18n from '@/i18n';
import { readStorage, writeStorageResult } from '@/services/storage';
import { gscSnapshotSchema } from './schema';
import { filtersEqual } from './filters';
import { snapshotGscPerformance } from './snapshot';
import { gscSnapshotStorageKey, MAX_GSC_SNAPSHOTS_PER_PROJECT } from './limits';

const browserGscStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: readStorage,
  setItem: (key, value) => {
    const result = writeStorageResult(key, value);
    if (!result.ok) throw result.error ?? new Error(i18n.t('runtimeErrors.gsc.unavailable'));
  },
};

export const readGscSnapshots = (projectId: string, storage: Pick<Storage, 'getItem'> = browserGscStorage): GscPerformanceSnapshot[] => {
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

export const saveGscSnapshot = (
  projectId: string,
  data: GscPerformanceData,
  storage: Pick<Storage, 'getItem' | 'setItem'> = browserGscStorage,
  capturedAt = new Date().toISOString(),
): { snapshots: GscPerformanceSnapshot[]; snapshot: GscPerformanceSnapshot } => {
  if (!projectId.trim()) throw new Error(i18n.t('runtimeErrors.schedules.projectRequired'));
  const snapshot = gscSnapshotSchema.parse(snapshotGscPerformance(data, capturedAt));
  const existing = readGscSnapshots(projectId, storage).filter((item) => !(
    item.site_url === snapshot.site_url
    && item.start_date === snapshot.start_date
    && item.end_date === snapshot.end_date
    && filtersEqual(item.filters, snapshot.filters)
  ));
  const snapshots = [snapshot, ...existing].slice(0, MAX_GSC_SNAPSHOTS_PER_PROJECT);
  storage.setItem(gscSnapshotStorageKey(projectId), JSON.stringify(snapshots));
  return { snapshots, snapshot };
};

