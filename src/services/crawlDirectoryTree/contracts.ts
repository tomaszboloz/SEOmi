import type { CrawledPageSummary } from '@/types';

export interface CrawlDirectoryMetrics {
  pageCount: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  requestErrors: number;
  criticalIssues: number;
  warningIssues: number;
  indexable: number;
  excluded: number;
  unknownIndexability: number;
  averageResponseMs: number | null;
  words: number;
}

export interface CrawlDirectoryNode {
  id: string;
  name: string;
  depth: number;
  ownPages: CrawledPageSummary[];
  childDirectories: CrawlDirectoryNode[];
  metrics: CrawlDirectoryMetrics;
}

export interface CrawlDirectoryTree {
  roots: CrawlDirectoryNode[];
  pageCount: number;
  ignoredPageCount: number;
  metrics: CrawlDirectoryMetrics;
}
