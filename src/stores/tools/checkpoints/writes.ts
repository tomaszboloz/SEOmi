import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { removeStorage, writeJsonStorage } from '@/services/storage';
import type { InterruptedCrawl } from '../contracts';
import { interruptedCrawlKey } from '../storageKeys';

export const interruptedCrawlWrites = new Map<string, Promise<void>>();

export const activeCrawlRuns = new Map<string, string>();

export const persistInterruptedCrawl = (projectId: string, value: InterruptedCrawl | null): void => {
  if (value) writeJsonStorage(interruptedCrawlKey(projectId), value);
  else removeStorage(interruptedCrawlKey(projectId));

  // Keep a native copy as well. Desktop WebViews can reject localStorage or
  // evict it under pressure, while the project crawl directory is already the
  // durable home for crawl history. Queue writes per project so a final clear
  // can never overtake the checkpoint created at crawl start.
  if (!isTauriEnvironment()) return;
  const previous = interruptedCrawlWrites.get(projectId) || Promise.resolve();
  const next = previous.then(async () => {
    try {
      if (value) {
        await invokeTauriCommand('save_project_crawl_checkpoint', { projectId, checkpoint: value });
      } else {
        await invokeTauriCommand('delete_project_crawl_checkpoint', { projectId });
      }
    } catch {
      // localStorage remains the compatibility fallback; the crawl itself must
      // not be marked failed solely because checkpoint backup is unavailable.
    }
  });
  interruptedCrawlWrites.set(projectId, next);
  void next.then(() => {
    if (interruptedCrawlWrites.get(projectId) === next) interruptedCrawlWrites.delete(projectId);
  });
};
