import type { UpdateWindow } from './normalize';

export const DATAFORSEO_SERP_VOLATILITY_URL = 'https://dataforseo.com/wp-admin/admin-ajax.php';
export const GOOGLE_SEARCH_STATUS_URL = 'https://status.search.google.com/incidents.json';

export type MarketSourceStatus = 'available' | 'unavailable' | 'unknown';
export interface MarketObservation { date: string; level: number }
export interface MarketSourceResult {
  status: MarketSourceStatus;
  source: string;
  observations: MarketObservation[];
  reason?: 'network' | 'http' | 'invalid-response' | 'empty';
}
export interface UpdateWindowSourceResult {
  status: MarketSourceStatus;
  source: string;
  windows: UpdateWindow[];
  reason?: 'network' | 'http' | 'invalid-response' | 'empty';
}

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type RecordValue = Record<string, unknown>;

const record = (value: unknown): RecordValue | null => value && typeof value === 'object' && !Array.isArray(value)
  ? value as RecordValue : null;
const dateOf = (value: unknown): string | null => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)
  ? value.slice(0, 10) : null;
const finiteLevel = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
export const liveFetcher = (): Fetcher | null => typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;

export const parseSerpVolatility = (payload: unknown, category: number | null = null): MarketObservation[] => {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item): MarketObservation[] => {
    const row = record(item);
    const metric = category === null ? record(row?.main_metric) : Array.isArray(row?.other_metrics)
      ? row.other_metrics.map(record).find(value => value?.category === category) : null;
    const date = dateOf(row?.date);
    const level = finiteLevel(metric?.volatility);
    return date && level !== null ? [{ date, level }] : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
};

export const fetchSerpVolatility = async (options: {
  locationCode?: number; device?: 'desktop' | 'mobile'; searchEngine?: 'google' | 'bing'; category?: number | null;
  fetcher?: Fetcher;
} = {}): Promise<MarketSourceResult> => {
  const fetcher = options.fetcher ?? liveFetcher();
  if (!fetcher) return { status: 'unavailable', source: 'dataforseo-serp-volatility', observations: [], reason: 'network' };
  const body = new URLSearchParams({ action: 'dfs_serp_sensor', location: String(options.locationCode ?? 2840), device_type: options.device ?? 'desktop', search_engine: options.searchEngine ?? 'google' });
  try {
    const response = await fetcher(DATAFORSEO_SERP_VOLATILITY_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!response.ok) return { status: 'unavailable', source: 'dataforseo-serp-volatility', observations: [], reason: 'http' };
    const observations = parseSerpVolatility(await response.json(), options.category ?? null);
    return observations.length ? { status: 'available', source: 'dataforseo-serp-volatility', observations }
      : { status: 'unknown', source: 'dataforseo-serp-volatility', observations: [], reason: 'empty' };
  } catch {
    return { status: 'unavailable', source: 'dataforseo-serp-volatility', observations: [], reason: 'network' };
  }
};

export const parseGoogleSearchStatus = (payload: unknown): UpdateWindow[] => {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item): UpdateWindow[] => {
    const row = record(item);
    const products = Array.isArray(row?.affected_products) ? row.affected_products.map(record) : [];
    const ranking = row?.service_name === 'Ranking' || products.some(product => product?.title === 'Ranking');
    const start = dateOf(row?.begin);
    const endRaw = row?.end;
    const end = endRaw === null || endRaw === undefined ? null : dateOf(endRaw);
    if (!ranking || !start || (end !== null && end < start)) return [];
    const label = typeof row?.external_desc === 'string' ? row.external_desc.trim() : '';
    return [{ start, end, ...(label ? { label } : {}), source: GOOGLE_SEARCH_STATUS_URL }];
  });
};

export const fetchGoogleSearchUpdateWindows = async (fetcher = liveFetcher()): Promise<UpdateWindowSourceResult> => {
  if (!fetcher) return { status: 'unavailable', source: 'google-search-status', windows: [], reason: 'network' };
  try {
    const response = await fetcher(GOOGLE_SEARCH_STATUS_URL);
    if (!response.ok) return { status: 'unavailable', source: 'google-search-status', windows: [], reason: 'http' };
    const windows = parseGoogleSearchStatus(await response.json());
    return windows.length ? { status: 'available', source: 'google-search-status', windows }
      : { status: 'unknown', source: 'google-search-status', windows: [], reason: 'empty' };
  } catch {
    return { status: 'unavailable', source: 'google-search-status', windows: [], reason: 'network' };
  }
};
