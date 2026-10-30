import { simulateHss, type HssReport } from '@/services/hss';
import type { ExecutiveAction } from './types';

/**
 * HSS delta of one action (GEM-89-04/06): the module's own declared gain is applied to a copy of the
 * baseline input (clamped to the 0-100 scale of that module) and HSS is recomputed under the same profile.
 * Without a declared module gain, a measured baseline module, or a shown baseline HSS the delta is null.
 */
export const hssDeltaFor = (action: ExecutiveAction, baseline: HssReport): number | null => {
  if (!action.moduleDelta || baseline.value === null) return null;
  const component = baseline.components.find((item) => item.module === action.moduleDelta?.module);
  if (!component || component.status !== 'measured' || component.value === null) return null;
  const next = Math.min(100, Math.max(0, component.value + action.moduleDelta.value));
  return simulateHss(baseline, { [component.module]: next }).delta;
};

const midEffort = (action: ExecutiveAction): number | null => (action.effort ? (action.effort.minHours + action.effort.maxHours) / 2 : null);

/** Explicit, explainable ranking key: HSS delta per estimated effort hour; null when either is unknown. */
export const actionRatio = (action: ExecutiveAction): number | null => {
  const effort = midEffort(action);
  return action.hssDelta === null || effort === null || effort <= 0 ? null : action.hssDelta / effort;
};

const nullLast = (left: number | null, right: number | null): number => {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
};

/**
 * Deterministic order (GEM-89-03): open before blocked, then ratio, then HSS delta, then module delta,
 * then id. Unknown values sort after known ones and are never replaced by invented numbers.
 */
export const rankActions = (actions: readonly ExecutiveAction[]): ExecutiveAction[] => [...actions].sort((left, right) =>
  Number(left.blocked) - Number(right.blocked)
  || nullLast(actionRatio(left), actionRatio(right))
  || nullLast(left.hssDelta, right.hssDelta)
  || nullLast(left.moduleDelta?.value ?? null, right.moduleDelta?.value ?? null)
  || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
