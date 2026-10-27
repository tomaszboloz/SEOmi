
import type { CrawlConfig, CrawlRunRecord, SiteCrawlResult } from '@/types';

export interface CrawlSaveResult {
  prunedRuns: number;
  /** Number of newest runs persisted with bounded evidence after quota recovery. */
  compactedRuns?: number;
}

export interface RecoveredActiveCrawlResult {
  start_url: string;
  crawl_mode?: 'http' | 'browser-rendered';
  pages_crawled: number;
  pages: SiteCrawlResult['pages'];
  health_score?: number;
  duration_ms?: number;
  critical_count?: number;
  warning_count?: number;
  notice_count?: number;
  cancelled: boolean;
  timed_out: boolean;
  robots_txt_status: 'unknown' | string;
  robots_blocked_count?: number;
  sitemap_status: 'unknown' | string;
  sitemap_urls_discovered?: number;
  sitemap_urls: string[];
}

export interface RecoveredActiveCrawlRun {
  id: string;
  projectId?: string;
  status: 'active' | 'in-flight' | 'interrupted';
  startedAt?: string;
  completedAt?: string;
  startUrl: string;
  config?: CrawlConfig;
  result: RecoveredActiveCrawlResult;
  environment?: 'default' | 'staging' | 'production';
  storage_compacted?: boolean;
}

export type AnyCrawlRun = CrawlRunRecord | RecoveredActiveCrawlRun;
