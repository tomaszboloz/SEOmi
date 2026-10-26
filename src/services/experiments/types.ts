import type { GscPerformanceFilters } from '@/types';

export type EvaluationReason = 'no-baseline' | 'no-follow-up' | 'incomparable-scope' | 'period-length-mismatch'
  | 'rows-truncated' | 'low-volume' | 'pending';
export type Limitation = EvaluationReason | 'observational' | 'uncontrolled-factors' | 'zero-baseline' | 'no-control'
  | 'filtered-scope' | 'invalid-period' | 'inconsistent-totals';
export interface ExperimentPeriod {
  startDate: string;
  endDate: string;
  siteUrl: string;
  filters?: GscPerformanceFilters;
  days: number;
}
export interface Metrics { clicks: number; impressions: number; position: number | null }
export interface MetricChange { before: number; after: number; absoluteChange: number; relativeChange: number | null }
export interface ExperimentChange {
  clicks: MetricChange;
  impressions: MetricChange;
  position: { before: number | null; after: number | null; absoluteChange: number | null };
}
export interface ExperimentEvaluation {
  status: 'ready' | 'inconclusive' | 'pending';
  reasons: EvaluationReason[];
  baseline: ExperimentPeriod | null;
  followUp: ExperimentPeriod | null;
  change: ExperimentChange | null;
  restOfSite: ExperimentChange | null;
  relativeVsSite: { clicks: number | null; impressions: number | null } | null;
  limitations: Limitation[];
}
