import type { GscPerformanceData } from '@/types';
import type { GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';
import { filtersEqual } from '@/services/gscTracker/filters';

/** Live report rows are independent of the bounded, persisted history snapshot. */
export const gscOpportunitySource = (snapshot: GscPerformanceSnapshot, data?: GscPerformanceData) => {
  const sameScope = data?.site_url === snapshot.site_url && data.start_date === snapshot.start_date
    && data.end_date === snapshot.end_date && filtersEqual(data.filters, snapshot.filters);
  return sameScope && data
    ? { queries: data.queries, truncated: data.queries_may_be_truncated === true }
    : { queries: snapshot.queries, truncated: snapshot.queries_may_be_truncated };
};
