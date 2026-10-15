import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { focusBudgetKey, SFS_FULL_RECOMPUTE_LIMIT, validFocusProject } from './keys';

export type Clock = () => number;
export interface RecomputeBudget { day: string; used: number; limit: number; remaining: number }

const pad = (value: number) => String(value).padStart(2, '0');
/** Local calendar day, so the allowance resets at the user's midnight. */
export const dayOf = (clock: Clock = Date.now): string => {
  const date = new Date(clock());
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const budgetOf = (day: string, used: number): RecomputeBudget => ({ day, used, limit: SFS_FULL_RECOMPUTE_LIMIT, remaining: Math.max(0, SFS_FULL_RECOMPUTE_LIMIT - used) });

export const readRecomputeBudget = (projectId: string | null | undefined, clock: Clock = Date.now): RecomputeBudget => {
  const day = dayOf(clock);
  if (!validFocusProject(projectId)) return budgetOf(day, SFS_FULL_RECOMPUTE_LIMIT);
  const raw = readJsonStorage(focusBudgetKey(projectId), null) as { day?: unknown; used?: unknown } | null;
  const used = raw && raw.day === day && typeof raw.used === 'number' && Number.isFinite(raw.used) ? Math.max(0, Math.floor(raw.used)) : 0;
  return budgetOf(day, used);
};

/** Spends one manual full recomputation; refuses once the daily limit is reached. */
export const consumeRecompute = (projectId: string | null | undefined, clock: Clock = Date.now): { allowed: boolean; budget: RecomputeBudget } => {
  const budget = readRecomputeBudget(projectId, clock);
  if (!validFocusProject(projectId) || budget.remaining <= 0) return { allowed: false, budget };
  const next = budgetOf(budget.day, budget.used + 1);
  if (!writeJsonStorage(focusBudgetKey(projectId), { day: next.day, used: next.used })) return { allowed: false, budget };
  return { allowed: true, budget: next };
};
