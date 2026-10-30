import type { HssSnapshot } from './history';
import { HSS_MODULES, type HssModule, type HssReport } from './types';

export interface HssTrend {
  previous: HssSnapshot;
  /** HSS change vs the previous comparable run; null when either side withheld the value. */
  hss: number | null;
  /** Per-module change; null when the module was not measured in either run. */
  modules: Record<HssModule, number | null>;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const diff = (now: number | null | undefined, before: number | null | undefined): number | null =>
  typeof now === 'number' && typeof before === 'number' ? round1(now - before) : null;

/**
 * Trend (#72 GEM-72-T05, #73 per-card trend): compares with the newest earlier run of the same project
 * and the same HSS profile id and version. Another profile is never a trend point.
 */
export const hssTrend = (report: HssReport, history: readonly HssSnapshot[], generatedAt: string): HssTrend | null => {
  const previous = history.find((row) => row.runId !== report.runId && row.generatedAt < generatedAt
    && row.profileId === report.profile.id && row.algorithmVersion === report.profile.version && row.value);
  if (!previous?.value) return null;
  const before = previous.value;
  const now = Object.fromEntries(report.components.map((item) => [item.module, item.value]));
  return {
    previous,
    hss: diff(report.value, before.hss),
    modules: Object.fromEntries(HSS_MODULES.map((module) => [module, diff(now[module], before.modules[module])])) as Record<HssModule, number | null>,
  };
};
