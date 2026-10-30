import { HSS_PROFILE, type HssProfile } from './profile';
import { HSS_MODULES, type HssComponent, type HssModuleInput, type HssReport } from './types';

const round1 = (value: number): number => Math.round(value * 10) / 10;
const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;

const classify = (input: HssModuleInput | undefined, runId: string): Pick<HssComponent, 'status' | 'value' | 'reason'> => {
  if (!input || input.value === null) return { status: 'unavailable', value: null, reason: input?.reason ?? 'not-provided' };
  if (!Number.isFinite(input.value) || input.value < 0 || input.value > 100) return { status: 'invalid', value: null, reason: 'out-of-range' };
  if (input.runId !== undefined && input.runId !== runId) return { status: 'incompatible', value: null, reason: 'different-run' };
  return { status: 'measured', value: input.value, ...(input.reason ? { reason: input.reason } : {}) };
};

/**
 * Holistic Semantic Score (#72). Renormalises only over explicitly measured modules: a measured 0 counts,
 * a missing, invalid or other-run module leaves both numerator and denominator (GEM-72-03/05).
 * Pure: the inputs are copied into the report and never mutated.
 */
export const computeHss = (inputs: readonly HssModuleInput[], runId: string, profile: HssProfile = HSS_PROFILE): HssReport => {
  const byModule = new Map(inputs.map((input) => [input.module, input]));
  const classified = HSS_MODULES.map((module) => ({ module, weight: profile.weights[module], ...classify(byModule.get(module), runId) }));
  const measured = classified.filter((item) => item.status === 'measured');
  const weightSum = measured.reduce((sum, item) => sum + item.weight, 0);
  const availableWeight = round4(weightSum);
  const components: HssComponent[] = classified.map((item) => ({
    ...item,
    effectiveWeight: item.status === 'measured' ? round4(item.weight / weightSum) : 0,
    contribution: item.value === null ? null : round4((item.value * item.weight) / weightSum),
  }));
  const renormalisedValue = weightSum > 0 ? round1(measured.reduce((sum, item) => sum + (item.value ?? 0) * item.weight, 0) / weightSum) : null;
  const status = !measured.length ? 'unavailable'
    : measured.length === HSS_MODULES.length ? 'complete'
      : weightSum + 1e-9 >= profile.minAvailableWeight ? 'partial' : 'insufficient';
  return {
    status,
    value: status === 'complete' || status === 'partial' ? renormalisedValue : null,
    renormalisedValue,
    availableWeight,
    measuredCount: measured.length,
    components,
    missing: components.filter((item) => item.status !== 'measured').map((item) => item.module),
    profile: { id: profile.id, version: profile.version },
    runId,
    inputs: inputs.map((input) => ({ ...input })),
  };
};
