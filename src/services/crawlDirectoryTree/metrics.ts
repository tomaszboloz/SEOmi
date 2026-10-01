import type { CrawledPageSummary } from '@/types';

import { CrawlDirectoryMetrics, CrawlDirectoryNode } from "./contracts";

export const emptyMetrics = (): CrawlDirectoryMetrics => ({
  pageCount: 0,
  status2xx: 0,
  status3xx: 0,
  status4xx: 0,
  status5xx: 0,
  requestErrors: 0,
  criticalIssues: 0,
  warningIssues: 0,
  indexable: 0,
  excluded: 0,
  unknownIndexability: 0,
  averageResponseMs: null,
  words: 0,
});

export const addPageMetrics = (metrics: CrawlDirectoryMetrics, page: CrawledPageSummary): void => {
  metrics.pageCount += 1;
  if (page.request_error_kind || page.http_status <= 0) metrics.requestErrors += 1;
  else if (page.http_status >= 200 && page.http_status < 300) metrics.status2xx += 1;
  else if (page.http_status >= 300 && page.http_status < 400) metrics.status3xx += 1;
  else if (page.http_status >= 400 && page.http_status < 500) metrics.status4xx += 1;
  else if (page.http_status >= 500 && page.http_status < 600) metrics.status5xx += 1;

  for (const issue of page.issues || []) {
    if (issue.severity === 'Critical') metrics.criticalIssues += 1;
    else if (issue.severity === 'Warning') metrics.warningIssues += 1;
  }

  const indexability = page.indexability_status || '';
  if (indexability.startsWith('Eligible')) metrics.indexable += 1;
  else if (/^(Blocked|Excluded|Canonical points|Redirect response)/i.test(indexability)) metrics.excluded += 1;
  else metrics.unknownIndexability += 1;

  if (Number.isFinite(page.word_count) && page.word_count > 0) metrics.words += page.word_count;
};

export const finalize = (node: CrawlDirectoryNode): { metrics: CrawlDirectoryMetrics; responseTimeTotal: number; responseTimeCount: number } => {
  const metrics = emptyMetrics();
  let responseTimeTotal = 0;
  let responseTimeCount = 0;
  for (const page of node.ownPages) {
    addPageMetrics(metrics, page);
    if (Number.isFinite(page.response_time_ms) && page.response_time_ms >= 0) {
      responseTimeTotal += page.response_time_ms;
      responseTimeCount += 1;
    }
  }
  for (const child of node.childDirectories) {
    const childSummary = finalize(child);
    const childMetrics = childSummary.metrics;
    for (const key of [
      'pageCount', 'status2xx', 'status3xx', 'status4xx', 'status5xx', 'requestErrors',
      'criticalIssues', 'warningIssues', 'indexable', 'excluded', 'unknownIndexability', 'words',
    ] as const) metrics[key] += childMetrics[key];
    responseTimeTotal += childSummary.responseTimeTotal;
    responseTimeCount += childSummary.responseTimeCount;
  }
  node.childDirectories.sort((left, right) => left.name.localeCompare(right.name));
  node.ownPages.sort((left, right) => left.url.localeCompare(right.url));
  metrics.averageResponseMs = responseTimeCount ? Math.round(responseTimeTotal / responseTimeCount) : null;
  node.metrics = metrics;
  return { metrics, responseTimeTotal, responseTimeCount };
};
