import type { UrlTelemetry } from '@/services/urlTelemetry';

/** PRI = max(normClicks, normConversions, normRefDomains); each norm = min(1, value / (threshold * multiplier)). */
export interface PriParams {
  clicksThreshold: number;
  clicksMultiplier: number;
  conversionsThreshold: number;
  conversionsMultiplier: number;
  domainsThreshold: number;
  domainsMultiplier: number;
}

export const DEFAULT_PRI_PARAMS: PriParams = {
  clicksThreshold: 50, clicksMultiplier: 4, conversionsThreshold: 1, conversionsMultiplier: 2, domainsThreshold: 5, domainsMultiplier: 3,
};

export type PriSignal = 'clicks' | 'conversions' | 'referringDomains';

export interface PriResult {
  /** Highest normalized signal among the values we actually have; null when none was measured. */
  pri: number | null;
  norms: Partial<Record<PriSignal, number>>;
  /** Signals with no usable value; never counted as zero. */
  unknown: PriSignal[];
}

const positive = (value: number, fallback: number): number => (Number.isFinite(value) && value > 0 ? value : fallback);

export const sanitizePriParams = (params: Partial<PriParams> = {}): PriParams => {
  const merged = { ...DEFAULT_PRI_PARAMS, ...params };
  return Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, positive(value, DEFAULT_PRI_PARAMS[key as keyof PriParams])])) as unknown as PriParams;
};

const norm = (value: number, threshold: number, multiplier: number): number => Math.min(1, Math.max(0, value) / (threshold * multiplier));

export const computePri = (telemetry: UrlTelemetry, input?: Partial<PriParams>): PriResult => {
  const p = sanitizePriParams(input);
  const norms: PriResult['norms'] = {};
  const gsc = telemetry.gsc.value;
  const ga4 = telemetry.ga4.value;
  const links = telemetry.backlinks.value;
  if (gsc) norms.clicks = norm(gsc.clicks, p.clicksThreshold, p.clicksMultiplier);
  if (ga4) norms.conversions = norm(ga4.keyEvents, p.conversionsThreshold, p.conversionsMultiplier);
  if (links) norms.referringDomains = norm(links.referringDomains, p.domainsThreshold, p.domainsMultiplier);
  const known = Object.values(norms);
  const signals: PriSignal[] = ['clicks', 'conversions', 'referringDomains'];
  return { pri: known.length ? Math.max(...known) : null, norms, unknown: signals.filter((signal) => norms[signal] === undefined) };
};
