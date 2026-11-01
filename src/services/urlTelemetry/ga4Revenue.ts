import { z } from 'zod';
import { MAX_REVENUE_ROWS, REVENUE_ATTRIBUTION, type RevenueImport } from './revenue';

/**
 * Revenue from the GA4 Data API (#91): the desktop command `google_analytics_revenue` returns organic-search
 * `totalRevenue` per landing page in the property currency GA4 reports. Needs a connected Google account and
 * an ecommerce/purchase setup in GA4; without revenue events GA4 returns zeros, which stay zeros, not guesses.
 */
const payload = z.object({
  status: z.enum(['complete', 'missing', 'partial']),
  property: z.string().min(1),
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  currency_code: z.string().regex(/^[A-Z]{3}$/u),
  attribution: z.literal(REVENUE_ATTRIBUTION),
  may_be_truncated: z.boolean(),
  rows: z.array(z.object({ landing_page: z.string().min(1), revenue: z.number().finite().nonnegative() })),
});

export type Ga4RevenueError = 'invalid-response' | 'no-rows';

export const ga4RevenueToImport = (raw: unknown, now: Date): RevenueImport | Ga4RevenueError => {
  const parsed = payload.safeParse(raw);
  if (!parsed.success) return 'invalid-response';
  const data = parsed.data;
  if (!data.rows.length) return 'no-rows';
  return {
    provider: 'ga4-api', attribution: REVENUE_ATTRIBUTION, currency: data.currency_code, organicOnly: true,
    period: data.start_date <= data.end_date ? { start: data.start_date, end: data.end_date } : null,
    sourceFile: `GA4 API ${data.property}`, importedAt: now.toISOString(),
    truncated: data.may_be_truncated || data.rows.length > MAX_REVENUE_ROWS,
    rows: data.rows.slice(0, MAX_REVENUE_ROWS).map((row) => ({ landingPage: row.landing_page, revenue: row.revenue })),
  };
};

/** Last 90 full days ending yesterday (UTC), computed from an injected clock. */
export const defaultRevenueRange = (now: Date): { startDate: string; endDate: string } => {
  const day = 86_400_000;
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  return { startDate: iso(base - 90 * day), endDate: iso(base - day) };
};
