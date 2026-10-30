import type { MeasureState, UrlTelemetry } from '@/services/urlTelemetry';
import { adviceFor, type ProtectionAdvice, type ProtectionAlternative } from './advice';
import { collectEvidence, type ProtectionEvidence, type ProtectionParameters } from './evidence';
import { computePri, sanitizePriParams, type PriParams, type PriResult, type PriSignal } from './pri';

export type ProtectionDecision = 'keep' | 'shield' | 'needs-data' | 'semantic-bridge' | 'prune-candidate';

export const DEFAULT_TRS_THRESHOLD = 40;
export const DEFAULT_PRI_THRESHOLD = 0.15;

export interface ProtectionOptions {
  trsThreshold?: number;
  priThreshold?: number;
  priParams?: Partial<PriParams>;
  /** Caller asserts a real topical link between the page's current thread and the Core topic. */
  relatedToCore?: boolean;
}

export type ProtectionReason = 'trs-above-threshold' | 'revenue' | 'conversions' | 'pri-above-threshold' | 'telemetry-incomplete' | 'low-pri-measured';

export interface ProtectionResult {
  url: string;
  decision: ProtectionDecision;
  reasons: ProtectionReason[];
  pri: PriResult;
  /** Telemetry states that are not plain measurements, per signal. */
  weakSignals: Partial<Record<PriSignal | 'revenue', MeasureState>>;
  /** Advisory only: a recommendation never changes a URL. */
  automaticAction: false;
  requiresBusinessReview: boolean;
  /** Manual alternatives; a 301 needs an adequate target and noindex is not done through robots.txt. */
  alternatives: ProtectionAlternative[];
  /** The same alternatives with the conditions that must hold first. */
  advice: ProtectionAdvice[];
  /** Every input as read, including unknown ones, so the decision can be explained and exported. */
  evidence: ProtectionEvidence[];
  parameters: ProtectionParameters;
}

const valid = (value: number | undefined, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback);

const weakStates = (t: UrlTelemetry): ProtectionResult['weakSignals'] => {
  const entries: Array<[PriSignal | 'revenue', MeasureState]> = [
    ['clicks', t.gsc.state], ['conversions', t.ga4.state], ['referringDomains', t.backlinks.state], ['revenue', t.revenue.state],
  ];
  return Object.fromEntries(entries.filter(([signal, state]) => state !== 'measured' && signal !== 'revenue'));
};

/**
 * Decision order protects value first: on-topic TRS, then revenue, then conversions, then the PRI
 * (clicks / conversions / referring domains), then missing telemetry. Only a fully measured low-value
 * page becomes a review candidate. Both threshold comparisons are inclusive (ties protect the page).
 */
export const decideProtection = (trs: number, telemetry: UrlTelemetry, options: ProtectionOptions = {}): ProtectionResult => {
  const trsThreshold = valid(options.trsThreshold, DEFAULT_TRS_THRESHOLD);
  const priThreshold = valid(options.priThreshold, DEFAULT_PRI_THRESHOLD);
  const priParams = sanitizePriParams(options.priParams);
  const pri = computePri(telemetry, priParams);
  const weakSignals = weakStates(telemetry);
  const parameters: ProtectionParameters = { trsThreshold, priThreshold, priParams, inclusive: true };
  const base = { url: telemetry.url, pri, weakSignals, automaticAction: false as const, evidence: collectEvidence(telemetry, pri), parameters };
  const revenue = telemetry.revenue.value;
  const conversions = telemetry.ga4.value?.keyEvents ?? 0;
  const done = (decision: ProtectionDecision, reasons: ProtectionReason[], alternatives: ProtectionAlternative[] = [], review = false): ProtectionResult =>
    ({ ...base, decision, reasons, requiresBusinessReview: review, alternatives, advice: adviceFor(alternatives) });

  if (trs >= trsThreshold) return done('keep', ['trs-above-threshold']);
  if (revenue && revenue.amount > 0 && revenue.currency?.trim()) return done('shield', ['revenue']);
  // Positive revenue without a currency is still evidence of value; never default one and never let it fall to pruning.
  if (revenue && revenue.amount > 0) return done('needs-data', ['telemetry-incomplete'], ['confirm-revenue-currency'], true);
  // Any conversion protects the page even when custom PRI parameters would normalise it below the threshold.
  if (conversions > 0) return done('shield', ['conversions']);
  if (pri.pri !== null && pri.pri >= priThreshold) return done('shield', ['pri-above-threshold']);
  if (Object.keys(weakSignals).length || pri.unknown.length) return done('needs-data', ['telemetry-incomplete'], ['check-gsc-ga4-backlinks-access']);
  const alternatives: ProtectionAlternative[] = ['redirect-301-to-relevant-target', 'canonical-for-duplicates', 'keep-and-rewrite', 'noindex-or-410-after-review'];
  return options.relatedToCore
    ? done('semantic-bridge', ['low-pri-measured'], ['link-to-pillar', ...alternatives], true)
    : done('prune-candidate', ['low-pri-measured'], alternatives, true);
};
