/** The seven HSS modules (#72). Off-Page (#93) is deliberately absent: adding it needs a new profile (HSS vNext ADR). */
export const HSS_MODULES = ['sfs', 'tas', 'igos', 'sprs', 'eetv', 'sija', 'aior'] as const;
export type HssModule = (typeof HSS_MODULES)[number];

/** One module scalar as handed over by its own engine: 0-100 or null when the engine could not measure it. */
export interface HssModuleInput {
  module: HssModule;
  value: number | null;
  /** Why the value is null (engine reason code), kept for the report. */
  reason?: string;
  /** Crawl run the module report was built from; a different run marks the input incompatible. */
  runId?: string;
}

export type HssComponentStatus = 'measured' | 'unavailable' | 'invalid' | 'incompatible';

export interface HssComponent {
  module: HssModule;
  /** Nominal profile weight. */
  weight: number;
  status: HssComponentStatus;
  value: number | null;
  /** Weight after renormalisation over measured modules; 0 when not measured. */
  effectiveWeight: number;
  contribution: number | null;
  reason?: string;
}

/**
 * complete: all seven measured. partial: renormalised over the measured subset with enough weight.
 * insufficient: measured weight below the profile minimum, the value is withheld. unavailable: nothing measured.
 */
export type HssStatus = 'complete' | 'partial' | 'insufficient' | 'unavailable';

export interface HssProfileRef { id: string; version: number }

export interface HssReport {
  status: HssStatus;
  /** Shown HSS; null unless status is complete or partial. */
  value: number | null;
  /** Renormalised value even below the minimum coverage, for transparency and reproduction only. */
  renormalisedValue: number | null;
  /** Sum of nominal weights of measured modules, 0-1. */
  availableWeight: number;
  measuredCount: number;
  components: HssComponent[];
  missing: HssModule[];
  profile: HssProfileRef;
  runId: string;
  /** Exact inputs, so the score can be recomputed (export / What-If). */
  inputs: HssModuleInput[];
}
