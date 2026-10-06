import { CrawledPageSummary, SiteCrawlResult } from '@/types';
import i18n from '@/i18n';
import type { CrawlComparisonContractOptions, CrawlComparisonProvenance, CrawlComparisonRun, CrawlComparisonStatus } from './crawlComparisonContract';
import { guardCrawlComparison } from './crawlComparisonContract';

export type CrawlChangeKind = 'added' | 'removed' | 'changed';

export interface CrawlPageChange {
  kind: CrawlChangeKind;
  url: string;
  fields: string[];
  /** URL from the other snapshot when two environments were matched by path. */
  matchedUrl?: string;
  /** Removed means the URL was not observed in the current snapshot. */
  observation?: 'not-observed';
}

export interface CrawlDiff {
  added: CrawlPageChange[];
  removed: CrawlPageChange[];
  changed: CrawlPageChange[];
}

export interface CrawlDiffReport extends CrawlDiff {
  status: CrawlComparisonStatus;
  reasons: string[];
  provenance: CrawlComparisonProvenance;
}

const comparableFields: Array<[keyof CrawledPageSummary, string]> = [
  ['http_status', i18n.t('crawlDiff.fields.httpStatus')],
  ['final_url', i18n.t('crawlDiff.fields.finalUrl')],
  ['title', i18n.t('crawlDiff.fields.title')],
  ['meta_description', i18n.t('crawlDiff.fields.metaDescription')],
  ['canonical', i18n.t('crawlDiff.fields.canonical')],
  ['meta_robots', i18n.t('crawlDiff.fields.metaRobots')],
  ['x_robots_tag', i18n.t('crawlDiff.fields.xRobotsTag')],
  ['indexability_status', i18n.t('crawlDiff.fields.indexability')],
];

export interface CrawlDiffOptions {
  /**
   * Ignore the origin so a staging/test snapshot can be compared with
   * production. The pathname and non-tracking query string remain part of
   * the key; this never claims that two different hosts are equivalent.
   */
  matchByPath?: boolean;
}

export type CrawlRunDiffOptions = CrawlDiffOptions & CrawlComparisonContractOptions;

const trackingQueryParameters = /^(utm_[^=]+|gclid|fbclid|msclkid)$/i;

export const crawlComparisonKey = (url: string, matchByPath = false): string => {
  if (!matchByPath) return url;
  try {
    const parsed = new URL(url);
    const query = [...parsed.searchParams.entries()]
      .filter(([name]) => !trackingQueryParameters.test(name))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
      .join('&');
    const pathname = parsed.pathname.replace(/\/$/, '') || '/';
    return `${pathname}${query ? `?${query}` : ''}`;
  } catch {
    return url.split('#', 1)[0];
  }
};

export function compareCrawlResults(
  current: SiteCrawlResult,
  baseline: SiteCrawlResult,
  options: CrawlDiffOptions = {},
): CrawlDiff {
  const key = (url: string) => crawlComparisonKey(url, options.matchByPath === true);
  const currentPages = new Map(current.pages.map((page) => [key(page.url), page]));
  const baselinePages = new Map(baseline.pages.map((page) => [key(page.url), page]));
  const added: CrawlPageChange[] = [];
  const removed: CrawlPageChange[] = [];
  const changed: CrawlPageChange[] = [];

  for (const [comparisonKey, page] of currentPages) {
    const earlier = baselinePages.get(comparisonKey);
    if (!earlier) {
      added.push({ kind: 'added', url: page.url, fields: [] });
      continue;
    }
    const fields = comparableFields
      .filter(([field]) => {
        if (options.matchByPath && (field === 'final_url' || field === 'canonical')) {
          const currentValue = typeof page[field] === 'string' ? crawlComparisonKey(page[field] as string, true) : page[field];
          const baselineValue = typeof earlier[field] === 'string' ? crawlComparisonKey(earlier[field] as string, true) : earlier[field];
          return currentValue !== baselineValue;
        }
        return page[field] !== earlier[field];
      })
      .map(([, label]) => label);
    if (fields.length) {
      changed.push({
        kind: 'changed',
        url: page.url,
        ...(options.matchByPath && earlier.url !== page.url ? { matchedUrl: earlier.url } : {}),
        fields,
      });
    }
  }
  for (const [comparisonKey, page] of baselinePages) {
    if (!currentPages.has(comparisonKey)) removed.push({ kind: 'removed', url: page.url, fields: [] });
  }
  return { added, removed, changed };
}

/** Compare persisted runs only after project, scope and completion guards pass. */
export function compareCrawlRuns(
  current: CrawlComparisonRun,
  baseline: CrawlComparisonRun,
  options: CrawlRunDiffOptions = {},
): CrawlDiffReport {
  const guard = guardCrawlComparison(current, baseline, options);
  if (guard.status === 'blocked') return { added: [], removed: [], changed: [], ...guard };
  const diff = compareCrawlResults(current.result, baseline.result, options);
  const baselinePartial = guard.provenance.baseline.partial;
  const currentPartial = guard.provenance.current.partial;
  return {
    status: guard.status,
    reasons: guard.reasons,
    provenance: guard.provenance,
    added: baselinePartial ? [] : diff.added,
    removed: currentPartial ? [] : diff.removed.map((change) => ({ ...change, observation: 'not-observed' as const })),
    changed: diff.changed,
  };
}
