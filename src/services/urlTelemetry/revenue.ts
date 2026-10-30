import type { BuildContext } from './gscSource';
import { measured, missing, periodDays, windowState } from './measure';
import type { Measure, SourceProvenance } from './types';
import { urlKey } from './urlKey';

/**
 * Revenue/attribution model for the shared URL telemetry (#91 GEM-91-03, D01).
 * Decision (default chosen by agent): revenue comes only from a GA4 report the user exported themselves
 * (landing page + revenue, filtered to organic sessions), attributed to the session landing page as GA4
 * reports it ("session landing page" attribution, not data-driven). The currency is stated by the user and
 * never inferred; amounts stay in that currency. A landing page missing from the export stays unknown, never 0.
 */
export const REVENUE_ATTRIBUTION = 'ga4-session-landing-page' as const;
export const MAX_REVENUE_ROWS = 5000;

export interface RevenueImport {
  provider: 'ga4-export';
  attribution: typeof REVENUE_ATTRIBUTION;
  currency: string;
  /** The user confirmed the export is limited to organic search sessions. */
  organicOnly: boolean;
  period: { start: string; end: string } | null;
  sourceFile: string;
  importedAt: string;
  truncated: boolean;
  rows: Array<{ landingPage: string; revenue: number }>;
}

export type RevenueParseError = 'no-header' | 'no-rows' | 'invalid-currency' | 'not-organic';

const compactDate = (value: string | undefined): string | null =>
  value && /^\d{8}$/u.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : null;

const cells = (line: string): string[] => {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { out.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  return [...out, cell.trim()];
};

/** Plain number as GA4 exports it ("1234.56"); grouping commas are dropped. Anything else is not a number. */
const amount = (value: string): number | null => {
  const clean = value.replace(/,/gu, '').trim();
  return /^-?\d+(?:\.\d+)?$/u.test(clean) ? Number(clean) : null;
};

export const parseGa4RevenueCsv = (
  text: string, options: { currency: string; organicOnly: boolean; sourceFile: string; now?: Date },
): RevenueImport | RevenueParseError => {
  const currency = options.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/u.test(currency)) return 'invalid-currency';
  if (!options.organicOnly) return 'not-organic';
  const lines = text.split(/\r?\n/u);
  const comment = (label: RegExp) => compactDate(lines.find((line) => line.startsWith('#') && label.test(line))?.split(':').pop()?.trim());
  const start = comment(/start date/iu);
  const end = comment(/end date/iu);
  const data = lines.filter((line) => line.trim() && !line.startsWith('#'));
  const headerIndex = data.findIndex((line) => /landing page/iu.test(line) && /revenue/iu.test(line));
  if (headerIndex < 0) return 'no-header';
  const header = cells(data[headerIndex]).map((cell) => cell.toLowerCase());
  const pageColumn = header.findIndex((cell) => cell.includes('landing page'));
  const revenueColumn = header.findIndex((cell) => cell.includes('revenue'));
  const totals = new Map<string, number>();
  data.slice(headerIndex + 1).forEach((line) => {
    const row = cells(line);
    const page = row[pageColumn];
    const value = amount(row[revenueColumn] ?? '');
    if (!page || value === null || /^\(not set\)$/iu.test(page)) return;
    totals.set(page, (totals.get(page) ?? 0) + value);
  });
  if (!totals.size) return 'no-rows';
  const rows = [...totals].map(([landingPage, revenue]) => ({ landingPage, revenue }));
  return {
    provider: 'ga4-export', attribution: REVENUE_ATTRIBUTION, currency, organicOnly: true,
    period: start && end && start <= end ? { start, end } : null, sourceFile: options.sourceFile.slice(0, 200),
    importedAt: (options.now ?? new Date()).toISOString(), truncated: rows.length > MAX_REVENUE_ROWS, rows: rows.slice(0, MAX_REVENUE_ROWS),
  };
};

export const revenueProvenance = (data: RevenueImport | null, now: Date): SourceProvenance => {
  if (!data) return { state: 'unavailable' };
  const state = data.truncated ? 'sampled' : data.period ? windowState(data.period.start, data.period.end, now) : 'partial-history';
  return {
    state, provider: `GA4 export (${data.sourceFile})`, retrievedAt: data.importedAt, truncated: data.truncated,
    currency: data.currency, attribution: data.attribution,
    ...(data.period ? { period: { ...data.period, days: periodDays(data.period.start, data.period.end) } } : {}),
  };
};

export const revenueMeasures = (data: RevenueImport | null, prov: SourceProvenance, ctx: BuildContext): Map<string, Measure<{ amount: number; currency: string }>> => {
  const out = new Map<string, Measure<{ amount: number; currency: string }>>();
  data?.rows.forEach((row) => {
    const key = urlKey(row.landingPage, ctx.base, ctx.scope, ctx.aliases);
    if (!key) return;
    out.set(key, measured({ amount: (out.get(key)?.value?.amount ?? 0) + row.revenue, currency: data.currency }, prov.state));
  });
  return out;
};

export const revenueAbsent = (data: RevenueImport | null): Measure<{ amount: number; currency: string }> =>
  missing('unavailable', data ? 'landing page not in the revenue export' : 'no revenue or currency source');
