import type { CrawlConfig, CrawlRunRecord, SiteCrawlResult } from '@/types';

export type CrawlComparisonRun = CrawlRunRecord & { projectId?: string };
export type CrawlComparisonStatus = 'comparable' | 'partial' | 'blocked';
export type CrawlComparisonReason =
  | 'same-run'
  | 'project-unverified'
  | 'different-project'
  | 'different-scope'
  | 'invalid-completion-time'
  | 'baseline-incomplete'
  | 'current-incomplete';

export interface CrawlRunEvidence {
  runId: string;
  completedAt: string;
  startUrl: string;
  scopeFingerprint: string;
  pageCount: number;
  completeness: 'complete' | 'incomplete';
  partial: boolean;
  partialReasons: string[];
  provenance: 'stored-crawl-run';
}

export interface CrawlComparisonProvenance {
  projectId?: string;
  baseline: CrawlRunEvidence;
  current: CrawlRunEvidence;
  scopeMatched: boolean;
  source: 'stored-crawl-runs';
}

export interface CrawlComparisonGuard {
  status: CrawlComparisonStatus;
  reasons: CrawlComparisonReason[];
  provenance: CrawlComparisonProvenance;
}

export interface CrawlComparisonContractOptions {
  projectId?: string;
  matchByPath?: boolean;
}

const executionOnly = new Set(['resumeCompletedUrls', 'resumeFrontierUrls']);
const normalizeUrl = (value: string, pathOnly: boolean): string => {
  try {
    const url = new URL(value.trim());
    url.hash = '';
    url.searchParams.sort();
    if (pathOnly) return `${url.pathname.replace(/\/$/u, '') || '/'}${url.search}`;
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/u, '') || url.toString();
  } catch {
    return value.trim().split('#', 1)[0];
  }
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, entry]) => entry !== undefined && !executionOnly.has(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, stableValue(entry)]));
};

const hash = (value: string): string => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
};

export const crawlConfigFingerprint = (config: CrawlConfig): string => hash(JSON.stringify(stableValue(config)));

export const crawlScopeFingerprint = (run: Pick<CrawlRunRecord, 'startUrl' | 'config'>, matchByPath = false): string => {
  const scope = {
    startUrl: normalizeUrl(run.startUrl, matchByPath),
    config: crawlConfigFingerprint(run.config),
  };
  return hash(JSON.stringify(scope));
};

const partialReasons = (result: SiteCrawlResult): string[] => {
  const reasons: string[] = [];
  if (result.storage_pages_truncated || (result.storage_pages_total ?? 0) > result.pages.length) reasons.push('storage-pages-truncated');
  if (result.discovery_provenance_truncated) reasons.push('discovery-provenance-truncated');
  if (result.resource_limit_reached) reasons.push('resource-limit-reached');
  if (result.pages_crawled > result.pages.length) reasons.push('page-index-truncated');
  return reasons;
};

export const assessCrawlRun = (run: CrawlComparisonRun): CrawlRunEvidence => {
  const incomplete = run.result.cancelled || run.result.timed_out === true;
  const reasons = partialReasons(run.result);
  return {
    runId: run.id,
    completedAt: run.completedAt,
    startUrl: run.startUrl,
    scopeFingerprint: crawlScopeFingerprint(run),
    pageCount: run.result.pages.length,
    completeness: incomplete ? 'incomplete' : 'complete',
    partial: reasons.length > 0,
    partialReasons: [...reasons, ...(run.result.cancelled ? ['cancelled'] : []), ...(run.result.timed_out ? ['timed-out'] : [])],
    provenance: 'stored-crawl-run',
  };
};

const validTime = (value: string): boolean => Boolean(value.trim() && Number.isFinite(Date.parse(value)));

export const guardCrawlComparison = (
  current: CrawlComparisonRun,
  baseline: CrawlComparisonRun,
  options: CrawlComparisonContractOptions = {},
): CrawlComparisonGuard => {
  const currentEvidence = assessCrawlRun(current);
  const baselineEvidence = assessCrawlRun(baseline);
  const currentScope = crawlScopeFingerprint(current, options.matchByPath === true);
  const baselineScope = crawlScopeFingerprint(baseline, options.matchByPath === true);
  currentEvidence.scopeFingerprint = currentScope;
  baselineEvidence.scopeFingerprint = baselineScope;
  const reasons: CrawlComparisonReason[] = [];
  const expected = options.projectId;
  const currentProject = current.projectId;
  const baselineProject = baseline.projectId;
  if (current.id === baseline.id) reasons.push('same-run');
  if (currentProject && baselineProject && currentProject !== baselineProject) reasons.push('different-project');
  if (expected && [currentProject, baselineProject].some((id) => id !== undefined && id !== expected)) reasons.push('different-project');
  if (!expected && (!currentProject || !baselineProject)) reasons.push('project-unverified');
  if (currentScope !== baselineScope) reasons.push('different-scope');
  if (!validTime(current.completedAt) || !validTime(baseline.completedAt)) reasons.push('invalid-completion-time');
  if (baselineEvidence.completeness === 'incomplete') reasons.push('baseline-incomplete');
  if (currentEvidence.completeness === 'incomplete') reasons.push('current-incomplete');
  const provenance: CrawlComparisonProvenance = {
    ...(expected ? { projectId: expected } : currentProject ? { projectId: currentProject } : {}),
    baseline: baselineEvidence,
    current: currentEvidence,
    scopeMatched: currentScope === baselineScope,
    source: 'stored-crawl-runs',
  };
  const blocked = reasons.length > 0;
  const partial = currentEvidence.partial || baselineEvidence.partial;
  return { status: blocked ? 'blocked' : partial ? 'partial' : 'comparable', reasons, provenance };
};
