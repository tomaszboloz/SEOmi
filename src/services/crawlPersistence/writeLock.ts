
// IndexedDB and the native Tauri command both accept concurrent writes, but
// their completion order is not guaranteed. Serialize writes per project so
// a delayed snapshot from an older crawl cannot overwrite a newer one.
const crawlWriteQueues = new Map<string, Promise<unknown>>();

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
