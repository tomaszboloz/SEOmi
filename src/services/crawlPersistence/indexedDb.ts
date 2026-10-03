import type { CrawlRunRecord } from '@/types';
import i18n from '@/i18n';
import { readStorage, writeStorageResult } from '@/services/storage';
import { bytesToBase64, decodeCrawlRunsFromStorage, encodeCrawlRunsForStorage } from './codec';
import type { StoredCrawlRuns } from './codec';
const DATABASE_NAME = 'seomi-local-data';
const STORE_NAME = 'crawl-runs';
const DATABASE_VERSION = 1;
const GZIP_FORMAT = 'seomi-crawl-gzip-json-v1';
const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') return reject(new Error(i18n.t('runtimeErrors.persistence.indexedDbUnavailable')));
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error(i18n.t('runtimeErrors.persistence.databaseOpenFailed')));
});

export const indexedDbRead = async (projectId: string): Promise<CrawlRunRecord[]> => {
  if (typeof indexedDB === 'undefined') {
    const raw = readStorage(`seomi_project_${projectId}_crawl_runs`);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return await decodeCrawlRunsFromStorage(parsed);
    } catch { return []; }
  }
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(projectId);
      request.onsuccess = () => {
        void decodeCrawlRunsFromStorage(request.result).then(resolve, reject);
      };
      request.onerror = () => reject(request.error ?? new Error(i18n.t('runtimeErrors.persistence.historyReadFailed')));
    });
  } finally { db.close(); }
};

export const indexedDbWriteOnce = async (projectId: string, runs: CrawlRunRecord[], encodedRuns?: StoredCrawlRuns): Promise<void> => {
  if (typeof indexedDB === 'undefined') {
    // Some embedded WebViews do not expose IndexedDB. Persist the compressed
    // payload there as base64 when the runtime supports it; older raw JSON
    // snapshots remain readable and are used when compression is unavailable.
    const value = encodedRuns ?? await encodeCrawlRunsForStorage(runs.slice(0, 50));
    const persisted = !Array.isArray(value) && value.format === GZIP_FORMAT
      ? (() => {
        const bytes = bytesToBase64(value.bytes);
        return bytes ? { format: GZIP_FORMAT, bytes } : runs.slice(0, 50);
      })()
      : value;
    const writeResult = writeStorageResult(`seomi_project_${projectId}_crawl_runs`, JSON.stringify(persisted));
    if (!writeResult.ok) throw writeResult.error ?? new Error(i18n.t('runtimeErrors.persistence.historyWriteFailed'));
    return;
  }
  const value = encodedRuns ?? await encodeCrawlRunsForStorage(runs.slice(0, 50));
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, projectId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error(i18n.t('runtimeErrors.persistence.crawlSaveFailed')));
      transaction.onabort = () => reject(transaction.error ?? new Error(i18n.t('runtimeErrors.persistence.crawlSaveAborted')));
    });
  } finally { db.close(); }
};
