/**
 * Shared analysis contracts (#85 GEM-85-01/02/04/06). Every module result can travel in one envelope that
 * says which project, crawl run, algorithm and model produced it and how complete it is. Unknown stays
 * null with a reason; a measured 0 is a value, never a placeholder.
 */
export type AvailabilityStatus = 'complete' | 'partial' | 'unavailable' | 'stale' | 'error' | 'cancelled';

export interface Availability {
  status: AvailabilityStatus;
  /** Machine-readable reason code; null when complete. */
  reason: string | null;
  /** Share of inputs that were measured (0..1); null when unknown. */
  coverage: number | null;
}

export interface ReportEnvelope<T> {
  projectId: string;
  /** Crawl run the result was computed from; null for inputs not tied to a crawl. */
  runId: string | null;
  module: string;
  algorithmVersion: number;
  profileId: string | null;
  modelId: string | null;
  contentHash: string | null;
  generatedAt: string;
  availability: Availability;
  /** Null whenever the result is not available: no fabricated 0. */
  value: T | null;
}

export const COMPLETE: Availability = Object.freeze({ status: 'complete', reason: null, coverage: 1 }) as Availability;

const clampCoverage = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;

export const availability = (status: AvailabilityStatus, reason: string | null = null, coverage?: number | null): Availability => ({
  status, reason: status === 'complete' ? null : reason ?? status, coverage: status === 'complete' ? 1 : clampCoverage(coverage),
});

/** Wraps a value; a non-complete status other than `partial`/`stale` drops the value so it cannot be read as measured. */
export const envelope = <T>(input: Omit<ReportEnvelope<T>, 'availability' | 'value' | 'profileId' | 'modelId' | 'contentHash'> & {
  value: T | null | undefined; availability?: Availability; profileId?: string | null; modelId?: string | null; contentHash?: string | null;
}): ReportEnvelope<T> => {
  const state = input.availability ?? (input.value === null || input.value === undefined ? availability('unavailable', 'no-value') : COMPLETE);
  const keeps = state.status === 'complete' || state.status === 'partial' || state.status === 'stale';
  return {
    projectId: input.projectId, runId: input.runId, module: input.module, algorithmVersion: input.algorithmVersion,
    profileId: input.profileId ?? null, modelId: input.modelId ?? null, contentHash: input.contentHash ?? null,
    generatedAt: input.generatedAt, availability: state, value: keeps ? input.value ?? null : null,
  };
};

const RANK: AvailabilityStatus[] = ['complete', 'stale', 'partial', 'cancelled', 'unavailable', 'error'];

export interface CombinedInputs {
  /** Status for a downstream aggregate (e.g. HSS): never `complete` over mixed runs or projects. */
  availability: Availability;
  runId: string | null;
  projectId: string | null;
}

/**
 * DAG guard (GEM-85-06): an aggregate may only consume results of one project and one crawl run.
 * Mixed runs or projects are an `error`; otherwise the worst upstream status propagates.
 */
export const combineInputs = (inputs: Array<ReportEnvelope<unknown>>): CombinedInputs => {
  if (!inputs.length) return { availability: availability('unavailable', 'no-inputs', 0), runId: null, projectId: null };
  const projects = new Set(inputs.map((item) => item.projectId));
  const runs = new Set(inputs.map((item) => item.runId).filter((run): run is string => run !== null));
  if (projects.size > 1) return { availability: availability('error', 'mixed-projects'), runId: null, projectId: null };
  const projectId = inputs[0].projectId;
  if (runs.size > 1) return { availability: availability('error', 'mixed-runs'), runId: null, projectId };
  const worst = inputs.reduce((acc, item) => (RANK.indexOf(item.availability.status) > RANK.indexOf(acc.availability.status) ? item : acc));
  const measured = inputs.filter((item) => item.value !== null).length / inputs.length;
  const runId = runs.size ? [...runs][0] : null;
  if (worst.availability.status === 'complete') return { availability: COMPLETE, runId, projectId };
  return { availability: availability(worst.availability.status, `${worst.module}:${worst.availability.reason ?? worst.availability.status}`, measured), runId, projectId };
};
