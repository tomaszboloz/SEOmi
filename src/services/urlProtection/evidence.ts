import type { MeasureState, UrlTelemetry } from '@/services/urlTelemetry';
import type { PriParams, PriResult, PriSignal } from './pri';

/** One input of the decision as it was read: the raw value and its state, never a defaulted zero. */
export interface ProtectionEvidence {
  signal: PriSignal | 'revenue';
  state: MeasureState;
  /** Raw measured value; null when the source gave none. */
  value: number | null;
  /** Revenue currency as reported; never defaulted. */
  currency?: string;
  /** Normalized PRI contribution (0-1); null for revenue and for unknown signals. */
  norm: number | null;
}

/**
 * Thresholds the decision used. Both comparisons are inclusive: TRS equal to the threshold keeps
 * the page and PRI equal to the threshold shields it, so a tie never pushes a page towards pruning.
 */
export interface ProtectionParameters {
  trsThreshold: number;
  priThreshold: number;
  priParams: PriParams;
  inclusive: true;
}

export const collectEvidence = (telemetry: UrlTelemetry, pri: PriResult): ProtectionEvidence[] => {
  const gsc = telemetry.gsc.value;
  const ga4 = telemetry.ga4.value;
  const links = telemetry.backlinks.value;
  const revenue = telemetry.revenue.value;
  const norm = (signal: PriSignal): number | null => pri.norms[signal] ?? null;
  return [
    { signal: 'clicks', state: telemetry.gsc.state, value: gsc ? gsc.clicks : null, norm: norm('clicks') },
    { signal: 'conversions', state: telemetry.ga4.state, value: ga4 ? ga4.keyEvents : null, norm: norm('conversions') },
    { signal: 'referringDomains', state: telemetry.backlinks.state, value: links ? links.referringDomains : null, norm: norm('referringDomains') },
    {
      signal: 'revenue', state: telemetry.revenue.state, value: revenue ? revenue.amount : null, norm: null,
      ...(revenue?.currency?.trim() ? { currency: revenue.currency.trim() } : {}),
    },
  ];
};
