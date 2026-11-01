import { z } from 'zod';
import type { Intervention } from './registry';
import { causalPageFor } from './pageCausal';
import { pageWindow, type PageInvoker, type PageSeries } from './pageSeries';
import type { CausalSetup } from './causalSeries';
import type { Ga4Outcomes, Outcome } from './ga4OutcomeStore';

const payload = z.object({
  property: z.string().min(1), currency_code: z.string().regex(/^[A-Z]{3}$/u),
  daily: z.array(z.object({ date: z.iso.date(), key_events: z.number().finite().nonnegative(), revenue: z.number().finite().nonnegative() })),
});

export const parseGa4Daily = (raw: unknown, now: Date): Ga4Outcomes | null => {
  const parsed = payload.safeParse(raw);
  if (!parsed.success || !parsed.data.daily.length) return null;
  const { property, currency_code, daily } = parsed.data;
  return { property, currency: currency_code, fetchedAt: now.toISOString(), daily: daily.map((row) => ({ date: row.date, keyEvents: row.key_events, revenue: row.revenue })).sort((a, b) => a.date.localeCompare(b.date)) };
};

/** Landing-page filter for a page URL; the whole site has none. */
export const landingPath = (target: string): string | undefined => (target === 'site' ? undefined : (() => { const url = new URL(target); return `${url.pathname}${url.search}`; })());

export const fetchGa4Outcomes = async (input: { projectId: string; clientId: string; siteUrl: string; target: string; interventionDate: string }, now: Date, invoke: PageInvoker): Promise<Ga4Outcomes | null> =>
  parseGa4Daily(await invoke<unknown>('google_analytics_daily', { projectId: input.projectId, clientId: input.clientId, siteUrl: input.siteUrl, pagePath: landingPath(input.target), ...pageWindow(input.interventionDate, now) }), now);

const asSeries = (series: Ga4Outcomes, outcome: Exclude<Outcome, 'gsc-clicks'>): PageSeries => ({
  site: series.property, fetchedAt: series.fetchedAt, daily: series.daily.map((row) => ({ date: row.date, clicks: outcome === 'ga4-revenue' ? row.revenue : row.keyEvents })),
});

/**
 * Counterfactual of a GA4 outcome (#97). The site-wide series has no independent control (every page is part of it),
 * so it runs without one; a page uses the other saved page series of the same outcome as control.
 */
export const causalOutcomeFor = (intervention: Intervention, saved: Readonly<Record<string, Ga4Outcomes>>, outcome: Exclude<Outcome, 'gsc-clicks'>): CausalSetup => {
  const candidates = Object.entries(saved).filter(([target]) => (intervention.url === 'site' ? target === 'site' : target !== 'site'));
  return causalPageFor(intervention, Object.fromEntries(candidates.map(([target, series]) => [target, asSeries(series, outcome)])));
};
