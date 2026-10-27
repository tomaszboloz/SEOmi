import type { CrawlRunRecord } from '@/types';
import type { TopicalMapDocument } from '@/services/topicalMap';
import type { Snapshot, SemanticRunChange, SemanticRunComparisonReport } from './semanticRunComparison/types';
import type { CrawlComparisonGuard } from './crawlComparisonContract';
import { MAX_PAGES, indexPages } from './semanticRunComparison/evidence';
import { comparePageChanges } from './semanticRunComparison/pageChanges';
import { compareRelationChanges } from './semanticRunComparison/relationChanges';
import { compareTopicChanges } from './semanticRunComparison/topicChanges';
export type { SemanticRunChangeCode, SemanticRunChange, SemanticRunComparisonReport } from './semanticRunComparison/types';
const MAX_CHANGES = 500;
export interface SemanticRunComparisonOptions { guard?: CrawlComparisonGuard; }

/**
 * Evidence-only comparison between two saved crawl snapshots. It compares
 * only `semantic_terms` and `semantic_links` for semantic changes; all deltas
 * are crawl observations, not proof of ranking, intent, or content deletion.
 */
export const compareSemanticRuns = (
  document: TopicalMapDocument,
  baseline: Pick<CrawlRunRecord, 'id' | 'result'>,
  current: Snapshot,
  options: SemanticRunComparisonOptions = {},
): SemanticRunComparisonReport => {
  const beforePages = baseline.result.pages.slice(0, MAX_PAGES);
  const afterPages = current.pages.slice(0, MAX_PAGES);
  const beforeIndex = indexPages(beforePages);
  const afterIndex = indexPages(afterPages);
  const changes: SemanticRunChange[] = [];
  let truncated = baseline.result.pages.length > MAX_PAGES || current.pages.length > MAX_PAGES;
  const counts: SemanticRunComparisonReport['counts'] = {
    'url-added': 0,
    'url-not-observed': 0,
    'content-terms-changed': 0,
    'content-link-added': 0,
    'content-link-not-observed': 0,
    'topic-edge-added': 0,
    'topic-edge-not-observed': 0,
    'topic-url-coverage-changed': 0,
    'query-term-observation-changed': 0,
  };
  const add = (change: SemanticRunChange) => {
    counts[change.code] += 1;
    if (changes.length < MAX_CHANGES) changes.push(change);
    else truncated = true;
  };

  comparePageChanges(beforeIndex, afterIndex, add);
  compareRelationChanges(beforePages, afterPages, add);
  if (beforePages.length > 500 || afterPages.length > 500) truncated = true;
  compareTopicChanges(document, beforeIndex, afterIndex, add);

  return { baselineRunId: baseline.id, currentRunId: current.id, changes, counts, truncated, ...(options.guard ? { guard: options.guard } : {}) };
};
