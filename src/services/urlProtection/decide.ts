import type { MeasureState, UrlTelemetry } from '@/services/urlTelemetry';
import { computePri, type PriParams, type PriResult, type PriSignal } from './pri';

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

export type ProtectionReason = 'trs-above-threshold' | 'revenue' | 'pri-above-threshold' | 'telemetry-incomplete' | 'low-pri-measured';

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
  alternatives: string[];
}

const valid = (value: number | undefined, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback);

const weakStates = (t: UrlTelemetry): ProtectionResult['weakSignals'] => {
  const entries: Array<[PriSignal | 'revenue', MeasureState]> = [
    ['clicks', t.gsc.state], ['conversions', t.ga4.state], ['referringDomains', t.backlinks.state], ['revenue', t.revenue.state],
  ];
  return Object.fromEntries(entries.filter(([signal, state]) => state !== 'measured' && signal !== 'revenue'));
};

export const decideProtection = (trs: number, telemetry: UrlTelemetry, options: ProtectionOptions = {}): ProtectionResult => {
  const trsThreshold = valid(options.trsThreshold, DEFAULT_TRS_THRESHOLD);
  const priThreshold = valid(options.priThreshold, DEFAULT_PRI_THRESHOLD);
  const pri = computePri(telemetry, options.priParams);
  const weakSignals = weakStates(telemetry);
  const base = { url: telemetry.url, pri, weakSignals, automaticAction: false as const };
  const revenue = telemetry.revenue.value;
  const done = (decision: ProtectionDecision, reasons: ProtectionReason[], alternatives: string[] = [], review = false): ProtectionResult =>
    ({ ...base, decision, reasons, requiresBusinessReview: review, alternatives });

  if (trs >= trsThreshold) return done('keep', ['trs-above-threshold']);
  if (revenue && revenue.amount > 0 && revenue.currency) return done('shield', ['revenue']);
  if (pri.pri !== null && pri.pri >= priThreshold) return done('shield', ['pri-above-threshold']);
  if (Object.keys(weakSignals).length || pri.unknown.length) return done('needs-data', ['telemetry-incomplete'], ['check-gsc-ga4-backlinks-access']);
  const alternatives = ['redirect-301-to-relevant-target', 'canonical-for-duplicates', 'keep-and-rewrite'];
  return options.relatedToCore
    ? done('semantic-bridge', ['low-pri-measured'], ['link-to-pillar', ...alternatives], true)
    : done('prune-candidate', ['low-pri-measured'], alternatives, true);
};
