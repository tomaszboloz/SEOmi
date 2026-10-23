import type { UrlTelemetrySnapshot } from './types';

/** Per-project cache: concurrent projects never overwrite each other; expired entries drop on read. */
const cache = new Map<string, UrlTelemetrySnapshot>();

export const putSnapshot = (snapshot: UrlTelemetrySnapshot): void => { cache.set(snapshot.projectId, snapshot); };

export const getSnapshot = (projectId: string, now: Date = new Date()): UrlTelemetrySnapshot | null => {
  const found = cache.get(projectId);
  if (!found) return null;
  if (Date.parse(found.expiresAt) <= now.getTime()) { cache.delete(projectId); return null; }
  return found;
};

export const clearSnapshots = (): void => cache.clear();
