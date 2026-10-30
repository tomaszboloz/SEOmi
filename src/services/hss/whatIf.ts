import { computeHss } from './compute';
import { HSS_PROFILE, type HssProfile } from './profile';
import type { HssModule, HssReport } from './types';

export interface HssWhatIf {
  baseline: HssReport;
  scenario: HssReport;
  /** Declared changes only: module -> new value (null = treat as unavailable). */
  changes: Partial<Record<HssModule, number | null>>;
  /** scenario.value - baseline.value; null when either side has no shown value. Not a traffic forecast. */
  delta: number | null;
}

/**
 * What-If (#72 GEM-72-07, #89 GEM-89-04): recomputes HSS on a copy of the baseline inputs with only the
 * declared module values changed, under the baseline profile and run. The baseline report is never mutated.
 */
export const simulateHss = (baseline: HssReport, changes: Partial<Record<HssModule, number | null>>, profile: HssProfile = HSS_PROFILE): HssWhatIf => {
  if (baseline.profile.id !== profile.id || baseline.profile.version !== profile.version) throw new Error('hss-profile-mismatch');
  const declared = Object.entries(changes) as Array<[HssModule, number | null]>;
  const inputs = baseline.inputs.map((input) => ({ ...input }));
  for (const [module, value] of declared) {
    const at = inputs.findIndex((input) => input.module === module);
    const next = { module, value, runId: baseline.runId, ...(value === null ? { reason: 'what-if-removed' } : {}) };
    if (at >= 0) inputs[at] = next; else inputs.push(next);
  }
  const scenario = computeHss(inputs, baseline.runId, profile);
  const delta = baseline.value === null || scenario.value === null ? null : Math.round((scenario.value - baseline.value) * 10) / 10;
  return { baseline, scenario, changes: { ...changes }, delta };
};

/** Trend points are comparable only under the same HSS profile id and version (GEM-72-T05). */
export const comparableHss = (left: Pick<HssReport, 'profile'>, right: Pick<HssReport, 'profile'>): boolean =>
  left.profile.id === right.profile.id && left.profile.version === right.profile.version;
