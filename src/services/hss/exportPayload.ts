import { computeHss } from './compute';
import { HSS_PROFILE, type HssProfile } from './profile';
import type { HssModuleInput, HssReport, HssStatus } from './types';

export const HSS_EXPORT_SCHEMA = 'seomi.hss/1';

/** Everything needed to recompute the score (GEM-72-08): profile, weights, run and the exact inputs. */
export interface HssExport {
  schema: typeof HSS_EXPORT_SCHEMA;
  profile: { id: string; version: number; weights: HssProfile['weights']; minAvailableWeight: number };
  runId: string;
  inputs: HssModuleInput[];
  status: HssStatus;
  value: number | null;
  availableWeight: number;
  note: 'seomi-heuristic-not-google-metric';
}

export const hssExportPayload = (report: HssReport, profile: HssProfile = HSS_PROFILE): HssExport => ({
  schema: HSS_EXPORT_SCHEMA,
  profile: { id: profile.id, version: profile.version, weights: { ...profile.weights }, minAvailableWeight: profile.minAvailableWeight },
  runId: report.runId,
  inputs: report.inputs.map((input) => ({ ...input })),
  status: report.status,
  value: report.value,
  availableWeight: report.availableWeight,
  note: 'seomi-heuristic-not-google-metric',
});

/** Recomputes an exported score from its own inputs and weights; true when it reproduces exactly. */
export const reproducesHss = (payload: HssExport): boolean => {
  const again = computeHss(payload.inputs, payload.runId, { id: payload.profile.id, version: payload.profile.version, weights: payload.profile.weights, minAvailableWeight: payload.profile.minAvailableWeight });
  return again.value === payload.value && again.status === payload.status && again.availableWeight === payload.availableWeight;
};
