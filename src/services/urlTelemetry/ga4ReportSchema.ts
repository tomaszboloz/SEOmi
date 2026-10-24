import { z } from 'zod';
import type { Ga4Report } from '@/types/ga4';

export const MAX_STORED_GA4_ROWS = 5000;
const metric = z.number().finite().nonnegative();
const text = z.string().refine(value => value.trim().length > 0);

export const ga4ReportSchema: z.ZodType<Ga4Report> = z.object({
  property: text,
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  rows: z.array(z.object({
    host_name: text,
    landing_page: text,
    sessions: metric,
    engaged_sessions: metric,
    key_events: metric,
  })).max(MAX_STORED_GA4_ROWS),
  may_be_truncated: z.boolean(),
  row_count: metric.int().nullable(),
  status: z.enum(['complete', 'missing', 'partial']).optional(),
  host_name: text.optional(),
  pages: metric.int().optional(),
}).refine(report => report.start_date <= report.end_date);
