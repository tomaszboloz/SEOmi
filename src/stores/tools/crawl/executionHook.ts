import { PersistentCrawlEventLog } from '@/services/snapshots';
import type { CrawledPageSummary, CrawlProgress } from '@/types';

/**
 * Streams in-flight crawl events directly to SQLite via PersistentCrawlEventLog.
 * Flushes terminal state on completion, cancellation, or error.
 */
export class LiveCrawlEventHook {
  private log: PersistentCrawlEventLog | null = null;

  constructor(
    readonly projectId: string,
    readonly runId: string,
    injectedLog?: PersistentCrawlEventLog | null,
  ) {
    // In Tauri desktop mode, the native crawler collector is the sole authoritative
    // sequence owner/writer to SQLite. Frontend only writes if an explicit injectedLog is provided.
    if (injectedLog !== undefined) {
      this.log = injectedLog;
    }
  }

  get eventLog(): PersistentCrawlEventLog | null {
    return this.log;
  }

  appendStarted(startUrl: string): void {
    this.log?.append('crawl:started', { id: this.runId, startUrl, provenance: 'live-crawl' });
  }

  appendProgress(progress: CrawlProgress): void {
    this.log?.append('crawl:progress', { ...progress, provenance: 'live-crawl' });
  }

  appendPages(pages: CrawledPageSummary[]): void {
    for (const page of pages) {
      this.log?.append('crawl:page', { ...page, provenance: 'live-crawl' });
    }
  }

  async appendCompleted(pageCount: number, completedAt: string, startUrl: string): Promise<void> {
    this.log?.append('crawl:completed', { id: this.runId, completedAt, pageCount, startUrl, provenance: 'live-crawl' });
    await this.flush();
  }

  async appendCancelled(pageCount: number, startUrl: string): Promise<void> {
    this.log?.append('crawl:cancelled', { id: this.runId, cancelledAt: new Date().toISOString(), pageCount, startUrl, provenance: 'live-crawl' });
    await this.flush();
  }

  async appendError(error: string): Promise<void> {
    this.log?.append('crawl:error', { id: this.runId, error, provenance: 'live-crawl' });
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.log) {
      await this.log.flush();
    }
  }
}

export const createLiveCrawlEventHook = (
  projectId?: string | null,
  runId?: string | null,
  injectedLog?: PersistentCrawlEventLog | null,
): LiveCrawlEventHook | null =>
  projectId && runId ? new LiveCrawlEventHook(projectId, runId, injectedLog) : null;
