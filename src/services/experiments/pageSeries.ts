import { z } from 'zod';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { CAUSAL_WINDOW_DAYS } from './causalSeries';

/**
 * Daily GSC clicks per page (#97), saved per project so a page-level intervention gets its own test series and
 * other saved pages can serve as controls. Pages are not independent of each other: a control page that shares
 * links, templates or topic with the changed page can be affected by the same change (contamination), which the
 * UI states next to the result.
 */
const entry = z.object({ site: z.string().min(1), fetchedAt: z.iso.datetime(), daily: z.array(z.object({ date: z.iso.date(), clicks: z.number().finite().nonnegative() })).max(1000) });
export type PageSeries = z.infer<typeof entry>;
const store = z.record(z.string(), entry);
export const pageSeriesKey = (projectId: string): string => `seomi_project_${projectId}_page_daily_v1`;
export const MAX_SAVED_PAGES = 12;

export const loadPageSeries = (projectId: string): Record<string, PageSeries> => {
  const parsed = store.safeParse(readJsonStorage(pageSeriesKey(projectId), {}));
  return parsed.success ? parsed.data : {};
};

export const savePageSeries = (projectId: string, url: string, series: PageSeries): boolean => {
  const all = { ...loadPageSeries(projectId), [url]: series };
  const kept = Object.entries(all).sort(([, a], [, b]) => b.fetchedAt.localeCompare(a.fetchedAt)).slice(0, MAX_SAVED_PAGES);
  return writeJsonStorage(pageSeriesKey(projectId), Object.fromEntries(kept));
};

const payload = z.object({ rows: z.array(z.object({ keys: z.tuple([z.iso.date()]), clicks: z.number().finite().nonnegative() })) });

export const parsePageDaily = (raw: unknown, site: string, now: Date): PageSeries | null => {
  const parsed = payload.safeParse(raw);
  return parsed.success ? { site, fetchedAt: now.toISOString(), daily: parsed.data.rows.map((row) => ({ date: row.keys[0], clicks: row.clicks })).sort((a, b) => a.date.localeCompare(b.date)) } : null;
};

export type PageInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
const DAY = 86_400_000;

/** Window of the counterfactual: up to 90 days around the change, never after the injected "today". */
export const pageWindow = (interventionDate: string, now: Date): { startDate: string; endDate: string } => {
  const time = Date.parse(`${interventionDate}T00:00:00Z`);
  const iso = (value: number) => new Date(value).toISOString().slice(0, 10);
  return { startDate: iso(time - CAUSAL_WINDOW_DAYS * DAY), endDate: iso(Math.min(time + (CAUSAL_WINDOW_DAYS - 1) * DAY, now.getTime() - 3 * DAY)) };
};

export const fetchPageSeries = async (input: { projectId: string; clientId: string; siteUrl: string; pageUrl: string; interventionDate: string }, now: Date, invoke: PageInvoker): Promise<PageSeries | null> =>
  parsePageDaily(await invoke<unknown>('search_console_page_daily', { projectId: input.projectId, clientId: input.clientId, siteUrl: input.siteUrl, pageUrl: input.pageUrl, ...pageWindow(input.interventionDate, now) }), input.siteUrl, now);
