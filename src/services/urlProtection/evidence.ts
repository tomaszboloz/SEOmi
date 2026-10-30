import type { MeasureState, UrlTelemetry } from '@/services/urlTelemetry';
import type { PriParams, PriResult, PriSignal } from './pri';

/** One input of the decision as it was read: the raw value and its state, never a defaulted zero. */
export interface ProtectionEvidence {
  /** `botHits` (verified Googlebot visits from imported logs, #81 GEM-81-08) is informational only. */
  signal: PriSignal | 'revenue' | 'botHits';
  state: MeasureState;
  /** Raw measured value; null when the source gave none. */
  value: number | null;
  /** Revenue currency as reported; never defaulted. */
  currency?: string;
  /** Normalized PRI contribution (0-1); null for revenue and for unknown signals. */
  norm: number | null;
  /** Days covered by imported server logs (`botHits` only). */
  days?: number | null;
}

/**
 * Decision (default chosen by agent, #81 GEM-81-D01/D02): TRS < 40 and PRI < 0.15 (PRI = max of
 * clicks/(50*4), conversions/(1*2), referring domains/(5*3), see ./pri) are the accepted defaults; both
 * comparisons are inclusive and revenue or any conversion always protects. `prune-candidate` is a
 * review label, never a "safe to delete" verdict: the report stays advisory and executes nothing.
 *
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
