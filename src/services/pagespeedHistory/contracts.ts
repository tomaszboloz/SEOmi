import type { CruxReport, PageSpeedReport, PageSpeedStrategy } from '@/services/pagespeed';


export const MAX_PAGESPEED_SNAPSHOTS = 24;

export interface PageSpeedSnapshot {
  id: string;
  capturedAt: string;
  url: string;
  strategy: PageSpeedStrategy;
  formFactor: CruxReport['formFactor'];
  scope: CruxReport['scope'];
  pageSpeed: PageSpeedReport | null;
  crux: CruxReport | null;
}

export interface PageSpeedSnapshotInput {
  url: string;
  strategy: PageSpeedStrategy;
  formFactor: CruxReport['formFactor'];
  scope: CruxReport['scope'];
  pageSpeed?: PageSpeedReport | null;
  crux?: CruxReport | null;
  capturedAt?: string;
}

export interface PageSpeedComparison {
  baseline: PageSpeedSnapshot;
  current: PageSpeedSnapshot;
  categoryDeltas: Array<{ key: keyof PageSpeedReport['categories']; baseline: number | null; current: number | null; delta: number | null }>;
  metricDeltas: Array<{ id: string; baseline: number | null; current: number | null; delta: number | null }>;
  cruxDeltas: Array<{ id: string; baseline: number | null; current: number | null; delta: number | null }>;
}
