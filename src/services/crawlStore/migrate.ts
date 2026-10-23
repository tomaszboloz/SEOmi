import type { CrawlRunRecord } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import { readStorage, writeStorage } from '@/services/storage';
import { parseCrawlRuns } from '../crawlContracts';
import { indexedDbRead } from '../crawlPersistence/indexedDb';

const doneKey = (projectId: string) => `seomi_store_v2_migrated_${projectId}`;
const backupKey = (projectId: string) => `seomi_project_${projectId}_crawl_runs_v1_backup`;
const inFlight = new Map<string, Promise<number>>();

const collectLegacy = async (projectId: string): Promise<CrawlRunRecord[]> => {
  const [file, web] = await Promise.all([
    invokeTauriCommand<unknown>('load_project_crawl_runs', { projectId }).then(parseCrawlRuns).catch(() => []),
    indexedDbRead(projectId).catch(() => []),
  ]);
  const seen = new Set<string>();
  return [...file, ...web].filter((run) => !seen.has(run.id) && seen.add(run.id));
};

const run = async (projectId: string): Promise<number> => {
  if (readStorage(doneKey(projectId)) === '1') return 0;
  const raw = readStorage(`seomi_project_${projectId}_crawl_runs`);
  // Keep a copy of the v1 slot so a failed or interrupted migration is recoverable.
  if (raw && readStorage(backupKey(projectId)) === null) writeStorage(backupKey(projectId), raw);
  const legacy = await collectLegacy(projectId);
  const imported = legacy.length
    ? await invokeTauriCommand<number>('store_import_legacy_runs', { projectId, source: 'v1', runs: legacy })
    : 0;
  // Marked only after the import succeeded; the Rust side is idempotent, so a
  // crash before this line just repeats the (skipping) import on next start.
  writeStorage(doneKey(projectId), '1');
  return imported;
};

/** One-shot, idempotent v1 -> v2 migration into SQLite. Resolves with imported run count. */
export const migrateLegacyCrawlRuns = (projectId: string): Promise<number> => {
  const pending = inFlight.get(projectId) ?? run(projectId).finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, pending);
  return pending;
};
