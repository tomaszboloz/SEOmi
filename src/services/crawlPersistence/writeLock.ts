
// IndexedDB and the native Tauri command both accept concurrent writes, but
// their completion order is not guaranteed. Serialize writes per project so
// a delayed snapshot from an older crawl cannot overwrite a newer one.
const crawlWriteQueues = new Map<string, Promise<unknown>>();
const crawlWriteGenerations = new Map<string, number>();

export const crawlWriteGeneration = (projectId: string): number =>
  crawlWriteGenerations.get(projectId) ?? 0;

/** Invalidate snapshots already waiting behind this project's write queue. */
export const invalidateQueuedCrawlWrites = (projectId: string): number => {
  const next = crawlWriteGeneration(projectId) + 1;
  crawlWriteGenerations.set(projectId, next);
  return next;
};

export const assertCrawlWriteGeneration = (projectId: string, generation: number): void => {
  if (crawlWriteGeneration(projectId) !== generation) {
    throw new Error('Crawl history write was invalidated by a project erasure.');
  }
};

export const withCrawlWriteLock = <T>(projectId: string, operation: () => Promise<T>): Promise<T> => {
  const previous = crawlWriteQueues.get(projectId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  crawlWriteQueues.set(projectId, current);
  void current.then(
    () => { if (crawlWriteQueues.get(projectId) === current) crawlWriteQueues.delete(projectId); },
    () => { if (crawlWriteQueues.get(projectId) === current) crawlWriteQueues.delete(projectId); },
  );
  return current;
};
