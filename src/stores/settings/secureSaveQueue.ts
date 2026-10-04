/**
 * Serializes keychain writes per key and tracks which write is the latest, so
 * a slow older save can neither run after nor overwrite a newer one.
 */
export const createSecureSaveQueue = () => {
  const queues = new Map<string, Promise<void>>();
  const revisions = new Map<string, number>();

  return {
    begin(key: string): number {
      const revision = (revisions.get(key) ?? 0) + 1;
      revisions.set(key, revision);
      return revision;
    },
    isLatest: (key: string, revision: number): boolean => revisions.get(key) === revision,
    enqueue(key: string, write: () => Promise<unknown>): Promise<void> {
      const save = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(write).then(() => undefined);
      queues.set(key, save);
      return save;
    },
    settle(key: string, save: Promise<void>): void {
      if (queues.get(key) === save) queues.delete(key);
    },
    get pending(): number {
      return queues.size;
    },
  };
};
