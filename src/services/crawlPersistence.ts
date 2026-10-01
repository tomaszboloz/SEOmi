import type { CrawlRunRecord } from '@/types';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { readStorage, removeStorage, writeStorageResult } from '@/services/storage';
import i18n from '@/i18n';
import { parseCrawlRuns } from './crawlContracts';

const DATABASE_NAME = 'seomi-local-data';
const STORE_NAME = 'crawl-runs';
const DATABASE_VERSION = 1;
const GZIP_FORMAT = 'seomi-crawl-gzip-json-v1';

/**
 * Older builds mirrored crawl history/result in Web Storage. Once IndexedDB
 * or the native project store is active those copies are obsolete, but a full
 * legacy JSON value can still consume the quota needed for recovery. Remove
 * only these two known compatibility keys after a quota failure; never touch
 * project preferences or the dedicated crawl store.
 */
const clearLegacyCrawlStorage = (projectId: string): void => {
  removeStorage(`seomi_project_${projectId}_crawl_result`);
  removeStorage(`seomi_project_${projectId}_crawl_runs`);
};

const clearLegacyCrawlResult = (projectId: string): void => {
  removeStorage(`seomi_project_${projectId}_crawl_result`);
};

// IndexedDB and the native Tauri command both accept concurrent writes, but
// their completion order is not guaranteed. Serialize writes per project so
// a delayed snapshot from an older crawl cannot overwrite a newer one.
const crawlWriteQueues = new Map<string, Promise<unknown>>();

const withCrawlWriteLock = <T>(projectId: string, operation: () => Promise<T>): Promise<T> => {
  const previous = crawlWriteQueues.get(projectId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  crawlWriteQueues.set(projectId, current);
  void current.then(
    () => { if (crawlWriteQueues.get(projectId) === current) crawlWriteQueues.delete(projectId); },
    () => { if (crawlWriteQueues.get(projectId) === current) crawlWriteQueues.delete(projectId); },
  );
  return current;
};

/**
 * Returns whether crawl history is stored outside the legacy localStorage
 * compatibility slot. The browser fallback intentionally keeps that slot as
 * its durable store when IndexedDB is unavailable.
 */
export const usesDedicatedCrawlStorage = (): boolean => isTauriEnvironment() || typeof indexedDB !== 'undefined';

type StoredCrawlRuns = CrawlRunRecord[] | { format: typeof GZIP_FORMAT; bytes: ArrayBuffer };

const bytesToBase64 = (bytes: ArrayBuffer): string | null => {
  if (typeof btoa !== 'function') return null;
  const value = new Uint8Array(bytes);
  let binary = '';
  for (let offset = 0; offset < value.length; offset += 0x8000) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (value: string): ArrayBuffer | null => {
  if (typeof atob !== 'function') return null;
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return bytes.buffer;
  } catch {
    return null;
  }
};

export const encodeCrawlRunsForStorage = async (runs: CrawlRunRecord[]): Promise<StoredCrawlRuns> => {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined' || typeof Blob.prototype.stream !== 'function' || typeof Response === 'undefined') return runs;
  const input = new Blob([JSON.stringify(runs)]).stream();
  const compressed = await new Response(input.pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return { format: GZIP_FORMAT, bytes: compressed };
};

export const decodeCrawlRunsFromStorage = async (value: unknown): Promise<CrawlRunRecord[]> => {
  if (Array.isArray(value)) return parseCrawlRuns(value);
  if (typeof value !== 'object' || value === null || !('format' in value) || !('bytes' in value)) return [];
  const stored = value as { format?: unknown; bytes?: unknown };
  if (stored.format !== GZIP_FORMAT || typeof DecompressionStream === 'undefined' || typeof Blob.prototype.stream !== 'function' || typeof Response === 'undefined') return [];
  const bytes = stored.bytes instanceof ArrayBuffer
    ? stored.bytes
    : typeof stored.bytes === 'string'
      ? base64ToArrayBuffer(stored.bytes)
      : null;
  if (!bytes) return [];
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const parsed: unknown = JSON.parse(await new Response(stream).text());
  return parseCrawlRuns(parsed);
};

export interface CrawlSaveResult {
  prunedRuns: number;
  /** Number of newest runs persisted with bounded evidence after quota recovery. */
  compactedRuns?: number;
}

/**
 * Reduce only verbose, repeatable evidence as a last-resort persistence
 * fallback. The in-memory result is never changed; a user can still inspect
 * the complete run until restart, while the persisted snapshot advertises its
 * bounded state through `storage_compacted` instead of failing the whole crawl.
 */
export const compactCrawlRunsForStorage = (runs: CrawlRunRecord[], level: 1 | 2 | 3 = 1): CrawlRunRecord[] => {
  const cloned = JSON.parse(JSON.stringify(runs)) as CrawlRunRecord[];
  const perPage = level === 1 ? 40 : level === 2 ? 10 : 0;
  const perPageIssues = level === 1 ? 40 : level === 2 ? 10 : 4;
  const perPageExcerpts = level === 1 ? 10 : level === 2 ? 3 : 0;
  return cloned.map((run) => {
    run.storage_compacted = true;
    const pages = Array.isArray(run.result.pages) ? run.result.pages : [];
    run.result.pages = pages.map((page) => ({
      ...page,
      links: (page.links || []).slice(0, perPage),
      images: (page.images || []).slice(0, perPage),
      semantic_links: page.semantic_links?.slice(0, perPage),
      semantic_excerpts: page.semantic_excerpts?.slice(0, perPageExcerpts),
      issues: (page.issues || []).slice(0, perPageIssues),
      html_validation_findings: page.html_validation_findings?.slice(0, perPageIssues).map((finding) => ({ ...finding, source_excerpt: undefined })),
      schema_validation_findings: page.schema_validation_findings?.slice(0, perPageIssues),
      custom_search_results: page.custom_search_results?.slice(0, perPage),
      content_terms: page.content_terms?.slice(0, level === 1 ? 20 : level === 2 ? 8 : 3),
      hreflangs: page.hreflangs?.slice(0, level === 1 ? 40 : level === 2 ? 12 : 4),
      canonical_targets: page.canonical_targets?.slice(0, level === 1 ? 20 : level === 2 ? 6 : 2),
      pagination_links: page.pagination_links?.slice(0, level === 1 ? 20 : level === 2 ? 6 : 2),
      schema_references: page.schema_references?.slice(0, level === 1 ? 40 : level === 2 ? 12 : 4),
      favicon_metadata: page.favicon_metadata?.slice(0, level === 1 ? 20 : level === 2 ? 6 : 2),
      favicon_resource_checks: page.favicon_resource_checks?.slice(0, level === 1 ? 20 : level === 2 ? 6 : 2),
      social_meta_tags: page.social_meta_tags?.slice(0, level === 1 ? 40 : level === 2 ? 12 : 4),
      frames: page.frames?.slice(0, level === 1 ? 20 : level === 2 ? 6 : 2),
      discovery_sources: page.discovery_sources?.slice(0, level === 1 ? 20 : level === 2 ? 6 : 2),
    }));
    if (level >= 2) {
      run.result.resources = undefined;
      run.result.sitemap_urls = (run.result.sitemap_urls || []).slice(0, level === 2 ? 500 : 100);
    } else {
      run.result.resources = run.result.resources?.slice(0, 2_000);
    }
    if (level === 3) {
      // Keep the crawl navigable while removing the large, repeatable payloads
      // that can make a single rendered run exceed a WebView quota.
      run.result.pages = run.result.pages.map((page) => ({
        ...page,
        // Preserve enough evidence to identify a problem, but never retain
        // source snippets or per-resource diagnostics in the last bounded
        // retry. Those fields are the dominant source of multi-page quota
        // failures and can be regenerated by running the crawl again.
        links: page.links.slice(0, 10).map((link) => ({
          target_url: link.target_url,
          anchor_text: link.anchor_text,
          rel: link.rel,
          is_internal: link.is_internal,
          target_http_status: link.target_http_status,
          target_redirect_url: link.target_redirect_url,
        })),
        images: page.images.slice(0, 10).map((image) => ({
          src: image.src,
          alt: image.alt,
          format: image.format,
          width: image.width,
          height: image.height,
          dimensions_source: image.dimensions_source,
          lazy_loaded: image.lazy_loaded,
          checked_in_run: image.checked_in_run,
          http_status: image.http_status,
          content_length: image.content_length,
        })),
        semantic_terms: page.semantic_terms?.slice(0, 12),
        content_terms: page.content_terms?.slice(0, 3),
        issues: page.issues.slice(0, 4),
        semantic_excerpts: undefined,
        schema_references: undefined,
        custom_search_results: undefined,
        favicon_metadata: undefined,
        favicon_resource_checks: undefined,
        social_meta_tags: undefined,
        frames: undefined,
        discovery_sources: undefined,
      }));
      run.result.rejected_urls = (run.result.rejected_urls || []).slice(0, 100);
      run.result.sitemap_urls = (run.result.sitemap_urls || []).slice(0, 100);
    }
    return run;
  });
};

/**
 * Last-resort durable representation for a single crawl when even the
 * bounded evidence snapshot cannot fit the WebView quota.  Keep the result
 * navigable (URL/status/health and one issue per page) while dropping all
 * repeated evidence arrays.  The complete result remains in memory for the
 * current session and the explicit marker prevents the persisted record from
 * being mistaken for a full crawl after restart.
 */
const compactCrawlRunsToPageIndex = (runs: CrawlRunRecord[]): CrawlRunRecord[] => {
  const cloned = JSON.parse(JSON.stringify(runs.slice(0, 1))) as CrawlRunRecord[];
  return cloned.map((run) => {
    const originalPages = Array.isArray(run.result.pages) ? run.result.pages : [];
    const totalPages = originalPages.length;
    const pages = originalPages.slice(0, 250).map((page) => ({
      url: page.url,
      final_url: page.final_url,
      redirect_chain: [],
      depth: page.depth,
      http_status: page.http_status,
      response_time_ms: page.response_time_ms,
      request_error_kind: page.request_error_kind,
      title: page.title,
      title_length: page.title_length,
      canonical: page.canonical,
      indexability_status: page.indexability_status,
      body_truncated: page.body_truncated,
      word_count: page.word_count,
      internal_link_count: page.internal_link_count,
      external_link_count: page.external_link_count,
      schema_types: [],
      schema_syntax_errors: page.schema_syntax_errors,
      document_language: page.document_language,
      hreflangs: [],
      h1_count: page.h1_count,
      heading_counts: page.heading_counts,
      links: [],
      images: [],
      issues_count: page.issues_count,
      issues: page.issues.slice(0, 1),
    }));
    run.storage_compacted = true;
    // Build the smallest valid result shape instead of spreading the source
    // result. A crawl can contain very large rejected-url and robots matrices;
    // carrying those top-level arrays into the final retry would reintroduce
    // the quota failure even though the page index itself is tiny.
    run.result = {
      start_url: run.result.start_url,
      crawl_mode: run.result.crawl_mode,
      pages_crawled: pages.length,
      health_score: run.result.health_score,
      critical_count: run.result.critical_count,
      warning_count: run.result.warning_count,
      notice_count: run.result.notice_count,
      pages,
      duration_ms: run.result.duration_ms,
      cancelled: run.result.cancelled,
      timed_out: run.result.timed_out,
      robots_txt_status: run.result.robots_txt_status,
      robots_user_agent: run.result.robots_user_agent,
      robots_blocked_count: run.result.robots_blocked_count,
      sitemap_status: run.result.sitemap_status,
      sitemap_urls_discovered: run.result.sitemap_urls_discovered,
      sitemap_urls: (run.result.sitemap_urls || []).slice(0, 100),
      storage_pages_truncated: totalPages > pages.length,
      storage_pages_total: totalPages,
      limit_reasons: run.result.limit_reasons,
    };
    return run;
  });
};

export const crawlQuotaRetryCounts = (runCount: number): number[] => {
  const counts: number[] = [];
  let count = runCount;
  while (count > 1) {
    count = Math.max(1, Math.floor(count / 2));
    counts.push(count);
  }
  return counts;
};

export const isStorageQuotaError = (error: unknown): boolean => {
  if (!error) return false;
  const quotaMessage = /quota|storage.*(?:full|limit)|disk.*full|no space left|not enough space|(?:exceed(?:s|ed|ing)?|przekracza|przekroczono).{0,64}limit/i;
  if (typeof error === 'string') return quotaMessage.test(error);
  if (typeof error !== 'object') return false;
  const quotaError = error as { name?: string; code?: number; message?: string };
  return quotaError.name === 'QuotaExceededError'
    || quotaError.code === 22
    || quotaError.code === 1014
    || quotaMessage.test(quotaError.message || '');
};

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') return reject(new Error(i18n.t('runtimeErrors.persistence.indexedDbUnavailable')));
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error(i18n.t('runtimeErrors.persistence.databaseOpenFailed')));
});

const indexedDbRead = async (projectId: string): Promise<CrawlRunRecord[]> => {
  if (typeof indexedDB === 'undefined') {
    const raw = readStorage(`seomi_project_${projectId}_crawl_runs`);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return decodeCrawlRunsFromStorage(parsed);
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

const indexedDbWriteOnce = async (projectId: string, runs: CrawlRunRecord[], encodedRuns?: StoredCrawlRuns): Promise<void> => {
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

const indexedDbWrite = async (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  const boundedRuns = runs.slice(0, 50);
  const dedicatedSave = (result: CrawlSaveResult): CrawlSaveResult => {
    // Once the dedicated store has accepted the snapshot, remove obsolete
    // Web Storage mirrors so they cannot consume quota on later workflows.
    // When IndexedDB is unavailable, crawl_runs is the active fallback store
    // and must remain intact; only the obsolete result mirror is removable.
    if (typeof indexedDB !== 'undefined') clearLegacyCrawlStorage(projectId);
    else clearLegacyCrawlResult(projectId);
    return result;
  };
  // The result mirror is never read by the dedicated history loader and can
  // be a large stale JSON value. Remove it before compression so it cannot
  // consume the quota needed to persist the authoritative run list.
  clearLegacyCrawlResult(projectId);
  // A crawl can contain thousands of repeated URL, header, and link strings.
  // Compress the snapshot before IndexedDB persistence so WebView quota is not
  // consumed by the same verbose JSON data that the UI can regenerate in memory.
  try {
    // Encoding itself can exhaust the WebView's available memory/storage quota
    // on large histories. Keep it inside the recovery boundary so we can retry
    // after dropping older crawl runs instead of leaking the raw DOMException.
    const encodedRuns = await encodeCrawlRunsForStorage(boundedRuns);
    await indexedDbWriteOnce(projectId, boundedRuns, encodedRuns);
    return dedicatedSave({ prunedRuns: 0 });
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    clearLegacyCrawlStorage(projectId);
  }

  // A full WebView quota should not make a completed crawl look like a failed
  // crawl. Retry with the newest run(s), discarding only the oldest history.
  for (const retainedCount of crawlQuotaRetryCounts(boundedRuns.length)) {
    try {
      const reducedRuns = boundedRuns.slice(0, retainedCount);
      await indexedDbWriteOnce(projectId, reducedRuns, await encodeCrawlRunsForStorage(reducedRuns));
      return dedicatedSave({ prunedRuns: boundedRuns.length - retainedCount });
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }
  }

  // A single, very large run can exceed the WebView quota even after older
  // history has been removed. Persist a clearly marked bounded snapshot as a
  // final recovery path instead of reporting that the crawl itself failed.
  for (const level of [1, 2, 3] as const) {
    try {
      const compactedRuns = compactCrawlRunsForStorage(boundedRuns.slice(0, 1), level);
      await indexedDbWriteOnce(projectId, compactedRuns, await encodeCrawlRunsForStorage(compactedRuns));
      return dedicatedSave({ prunedRuns: boundedRuns.length - 1, compactedRuns: 1 });
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }
  }

  // A final page-index snapshot is intentionally tiny and can recover from
  // very small browser quotas where evidence compaction still fails.
  try {
    const pageIndex = compactCrawlRunsToPageIndex(boundedRuns);
    await indexedDbWriteOnce(projectId, pageIndex, await encodeCrawlRunsForStorage(pageIndex));
    return dedicatedSave({ prunedRuns: boundedRuns.length - 1, compactedRuns: 1 });
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    clearLegacyCrawlStorage(projectId);
  }

  throw new Error(i18n.t('runtimeErrors.persistence.localQuota'));
};

export const loadCrawlRuns = (projectId: string): Promise<CrawlRunRecord[]> => isTauriEnvironment()
  ? invokeTauriCommand<unknown>('load_project_crawl_runs', { projectId }).then(parseCrawlRuns)
  : indexedDbRead(projectId);

const saveCrawlRunsUnlocked = async (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> => {
  if (!isTauriEnvironment()) return indexedDbWrite(projectId, runs);

  const boundedRuns = runs.slice(0, 50);
  const dedicatedSave = (result: CrawlSaveResult): CrawlSaveResult => {
    clearLegacyCrawlStorage(projectId);
    return result;
  };
  try {
    await invokeTauriCommand<void>('save_project_crawl_runs', { projectId, crawlRuns: boundedRuns });
    return dedicatedSave({ prunedRuns: 0 });
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    clearLegacyCrawlStorage(projectId);
  }

  // Desktop storage can also run out of space. Keep the newest crawl and retry
  // after dropping progressively more of the older project history.
  for (const retainedCount of crawlQuotaRetryCounts(boundedRuns.length)) {
    try {
      await invokeTauriCommand<void>('save_project_crawl_runs', {
        projectId,
        crawlRuns: boundedRuns.slice(0, retainedCount),
      });
      return dedicatedSave({ prunedRuns: boundedRuns.length - retainedCount });
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }
  }

  for (const level of [1, 2, 3] as const) {
    try {
      const compactedRuns = compactCrawlRunsForStorage(boundedRuns.slice(0, 1), level);
      await invokeTauriCommand<void>('save_project_crawl_runs', {
        projectId,
        crawlRuns: compactedRuns,
      });
      return dedicatedSave({ prunedRuns: boundedRuns.length - 1, compactedRuns: 1 });
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }
  }

  try {
    const pageIndex = compactCrawlRunsToPageIndex(boundedRuns);
    await invokeTauriCommand<void>('save_project_crawl_runs', {
      projectId,
      crawlRuns: pageIndex,
    });
    return dedicatedSave({ prunedRuns: boundedRuns.length - 1, compactedRuns: 1 });
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
  }

  throw new Error(i18n.t('runtimeErrors.persistence.diskQuota'));
};

export const saveCrawlRuns = (projectId: string, runs: CrawlRunRecord[]): Promise<CrawlSaveResult> =>
  withCrawlWriteLock(projectId, () => saveCrawlRunsUnlocked(projectId, runs));
