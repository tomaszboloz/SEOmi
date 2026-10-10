import type { GscPerformanceSnapshot, GscSnapshotComparison } from '@/services/gscPerformanceTracker';
import type { PageSpeedComparison, PageSpeedSnapshot } from '@/services/pagespeedHistory';
import type { CrawlDiffReport } from '@/services/crawlDiff';
import type { SemanticRunComparisonReport } from '@/services/semanticRunComparison';

export type MonitoringAlertType = 'gsc' | 'pagespeed' | 'crawl' | 'semantic';
export type MonitoringAlertFrequency = 'run' | 'daily' | 'weekly';

export interface MonitoringAlertSettings {
  enabled: boolean;
  frequency: MonitoringAlertFrequency;
  types: Record<MonitoringAlertType, boolean>;
  thresholds: {
    gsc: { declinePercent: number; minImpressions: number };
    pagespeed: { categoryDrop: number; metricIncrease: number; maxWindowDays: number };
    crawl: { changedPages: number };
    semantic: { changes: number };
  };
}

export interface MonitoringAlert {
  type: MonitoringAlertType;
  fingerprint: string;
  sourceId: string;
  title: string;
  body: string;
  occurredAt: string;
  partial: boolean;
  evidence: Record<string, number | string | boolean>;
}

export interface PageSpeedComparisonGuard {
  status: 'comparable' | 'blocked';
  reasons: string[];
  windowDays: number | null;
}

export type MonitoringInputs = {
  gsc: { baseline: GscPerformanceSnapshot; current: GscPerformanceSnapshot; comparison?: GscSnapshotComparison };
  pagespeed: { baseline: PageSpeedSnapshot; current: PageSpeedSnapshot; comparison?: PageSpeedComparison };
  crawl: CrawlDiffReport;
  semantic: SemanticRunComparisonReport;
};
