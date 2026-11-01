import type { SprsReport } from '@/services/semanticGraph/sprs';
import type { HssModuleInput } from './types';

/**
 * Site-level scalars for the per-page engines (#72 GEM-72-D01/D02, accepted by owner delegation 2026-11-01).
 * IGOS and SIJA: mean of the latest measured per-phrase scores, only with at least `minScored` of them; nulls are
 * skipped, never counted as 0. SPRS: share of pages that are neither under-linked nor leaking. Change = new HSS profile version.
 */
export const PAGE_MODULE_PROFILE = { minScored: 3, sprsMinPages: 3 } as const;

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Mean of the finite scores; below the minimum count the module is unavailable with a reason, not a guess. */
export const meanModuleInput = (module: 'igos' | 'sija', scores: ReadonlyArray<number | null> | undefined, runId: string): HssModuleInput => {
  if (!scores) return { module, value: null, reason: 'not-run' };
  const measured = scores.filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  if (measured.length < PAGE_MODULE_PROFILE.minScored) return { module, value: null, reason: 'insufficient-pages' };
  return { module, value: round1(measured.reduce((sum, score) => sum + score, 0) / measured.length), runId };
};

/** SPRS link health: 100 * pages that are not under-linked and not leaking / all pages. */
export const sprsModuleInput = (report: SprsReport | null | undefined, runId: string): HssModuleInput => {
  if (!report) return { module: 'sprs', value: null, reason: 'not-run' };
  if (report.status !== 'ready') return { module: 'sprs', value: null, reason: 'sprs-unavailable' };
  if (report.pages.length < PAGE_MODULE_PROFILE.sprsMinPages) return { module: 'sprs', value: null, reason: 'insufficient-pages' };
  if (!report.converged) return { module: 'sprs', value: null, reason: 'sprs-not-converged' };
  const healthy = report.pages.filter((page) => !page.underLinked && !page.leak).length;
  return { module: 'sprs', value: round1((healthy / report.pages.length) * 100), runId };
};
