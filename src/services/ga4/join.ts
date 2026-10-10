import type { GscPerformanceData, SiteCrawlResult } from '@/types';
import type { Ga4JoinResult, Ga4Report } from '@/types/ga4';

interface Scope { protocol: string; host: string; port: string; origin: string; }

const scopeOf = (value?: string): Scope | null => {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return { protocol: url.protocol, host, port: url.port, origin: `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}` };
  } catch { return null; }
};

const pathKey = (path: string): string => path === '/' ? '/' : path.replace(/\/+$/, '') || '/';

const urlKey = (value: string, base: string, scope: Scope): string | null => {
  try {
    const url = new URL(value, base);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.protocol !== scope.protocol || host !== scope.host || url.port !== scope.port) return null;
    return `${scope.origin}${pathKey(url.pathname || '/')}${url.search}`;
  } catch { return null; }
};

const metricRow = (row: GscPerformanceData['pages'][number]) => Number.isFinite(row.clicks) && Number.isFinite(row.impressions) && Number.isFinite(row.ctr) && Number.isFinite(row.position)
  ? { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position } : undefined;

export interface Ga4JoinInput { report: Ga4Report; gscData?: GscPerformanceData | null; crawlResult?: SiteCrawlResult | null; projectRootUrl?: string; }

export const joinGa4Evidence = ({ report, gscData, crawlResult, projectRootUrl }: Ga4JoinInput): Ga4JoinResult => {
  const scope = scopeOf(projectRootUrl);
  const warnings: string[] = [];
  if (!scope) warnings.push('Project root URL is missing or invalid.');
  const gscPeriodMatches = !!gscData && gscData.start_date === report.start_date && gscData.end_date === report.end_date;
  if (gscData && !gscPeriodMatches) warnings.push('Google Search Console and Google Analytics periods differ.');
  const gsc = new Map<string, ReturnType<typeof metricRow>>();
  if (scope && gscPeriodMatches && gscData) for (const page of gscData.pages) {
    const key = urlKey(page.page, projectRootUrl || '', scope);
    const metrics = metricRow(page);
    if (key && metrics && !gsc.has(key)) gsc.set(key, metrics);
  }
  const crawl = new Map<string, number>();
  if (scope && crawlResult) for (const page of crawlResult.pages) {
    const key = urlKey(page.url, projectRootUrl || '', scope);
    if (key && Number.isFinite(page.issues_count) && page.issues_count >= 0 && !crawl.has(key)) crawl.set(key, page.issues_count);
  }
  let matchedGsc = 0;
  let matchedCrawl = 0;
  const rows = report.rows.map((row) => {
    const host = row.host_name.toLowerCase().replace(/\.$/, '');
    if (!scope || host !== scope.host) return { ...row };
    const key = urlKey(row.landing_page, projectRootUrl || '', scope);
    const gscMetrics = key ? gsc.get(key) : undefined;
    const crawlIssues = key ? crawl.get(key) : undefined;
    if (gscMetrics) matchedGsc += 1;
    if (crawlIssues !== undefined) matchedCrawl += 1;
    return { ...row, ...(gscMetrics ? { gsc: gscMetrics } : {}), ...(crawlIssues !== undefined ? { crawl_issue_count: crawlIssues } : {}) };
  });
  return { rows, matched_gsc_rows: matchedGsc, matched_crawl_rows: matchedCrawl, gsc_period_matches: gscPeriodMatches, warnings };
};
