import type { UrlTelemetrySnapshot } from './types';

/** Per-project cache: concurrent projects never overwrite each other; expired entries drop on read. */
const cache = new Map<string, UrlTelemetrySnapshot>();

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** The cached snapshot is immutable (#91 GEM-91-07): a guardrail or report reading it cannot alter it for the next reader. */
export const putSnapshot = (snapshot: UrlTelemetrySnapshot): void => { cache.set(snapshot.projectId, freeze(snapshot)); };

export const getSnapshot = (projectId: string, now: Date = new Date()): UrlTelemetrySnapshot | null => {
  const found = cache.get(projectId);
  if (!found) return null;
  if (Date.parse(found.expiresAt) <= now.getTime()) { cache.delete(projectId); return null; }
  return found;
};

export const dropSnapshot = (projectId: string): void => { cache.delete(projectId); };

export const clearSnapshots = (): void => cache.clear();
