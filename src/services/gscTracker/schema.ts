import { z } from 'zod';
import type { GscPerformanceSnapshot } from './types';
import { MAX_STORED_GSC_ROWS_PER_DIMENSION } from './limits';

const gscMetric = z.number().finite().nonnegative();
const gscRowMetrics = { clicks: gscMetric, impressions: gscMetric, ctr: gscMetric, position: gscMetric };
export const gscSnapshotSchema: z.ZodType<GscPerformanceSnapshot> = z.object({
  id: z.string(), captured_at: z.string(), site_url: z.string(), start_date: z.string(), end_date: z.string(),
  filters: z.object({
    search_type: z.enum(['web', 'image', 'video', 'news', 'discover', 'googleNews']).optional(),
    device: z.enum(['DESKTOP', 'MOBILE', 'TABLET']).optional(),
    country: z.string().regex(/^[a-z]{3}$/).optional(),
  }).optional(),
  total_clicks: gscMetric, total_impressions: gscMetric, avg_ctr: gscMetric, avg_position: gscMetric,
  queries: z.array(z.object({ query: z.string(), ...gscRowMetrics })).max(MAX_STORED_GSC_ROWS_PER_DIMENSION),
  pages: z.array(z.object({ page: z.string(), ...gscRowMetrics })).max(MAX_STORED_GSC_ROWS_PER_DIMENSION),
  query_pages: z.array(z.object({ query: z.string().refine(value => value.trim().length > 0), page: z.string().url(),
    ...gscRowMetrics })).max(MAX_STORED_GSC_ROWS_PER_DIMENSION).optional(),
  query_pages_may_be_truncated: z.boolean().optional(), stored_query_page_rows: gscMetric.int().optional(),
  queries_may_be_truncated: z.boolean(), pages_may_be_truncated: z.boolean(),
  max_rows_per_dimension: gscMetric.int(), stored_query_rows: gscMetric.int(), stored_page_rows: gscMetric.int(),
}).refine(value => value.stored_query_rows === value.queries.length && value.stored_page_rows === value.pages.length)
  .refine(value => value.query_pages === undefined
    ? value.stored_query_page_rows === undefined && value.query_pages_may_be_truncated === undefined
    : value.stored_query_page_rows === value.query_pages.length && value.query_pages_may_be_truncated !== undefined);
