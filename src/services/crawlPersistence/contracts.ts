
export interface CrawlSaveResult {
  prunedRuns: number;
  /** Number of newest runs persisted with bounded evidence after quota recovery. */
  compactedRuns?: number;
}
