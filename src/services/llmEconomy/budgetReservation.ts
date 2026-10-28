import { readLlmBudget, readLlmSpend, readLlmStorageState, withinProjectBudget } from './llmBudget';

const pending = new Map<string, number>();

export const reserveProjectBudget = (projectId: string, local: boolean, estimatedCost: number | null, now: Date): (() => void) => {
  if (local) return () => undefined;
  const budget = readLlmBudget(projectId);
  const storage = readLlmStorageState(projectId);
  if (storage.budget === 'invalid' || storage.budget === 'unavailable') throw new Error('Project LLM budget storage is unavailable or invalid; refusing an unpriced cloud call');
  if (budget.monthlyLimitUsd !== null && (storage.spend === 'invalid' || storage.spend === 'unavailable')) throw new Error('Project LLM spend storage is unavailable or invalid; refusing a cloud call under an active budget');
  if (budget.monthlyLimitUsd === null) return () => undefined;
  if (estimatedCost === null) throw new Error('Cannot execute unpriced external LLM call under active project budget limit');
  const reserved = pending.get(projectId) ?? 0;
  if (!withinProjectBudget(projectId, estimatedCost, now) || readLlmSpend(projectId, now).spentUsd + reserved + estimatedCost > budget.monthlyLimitUsd) throw new Error('Project LLM budget exceeded');
  pending.set(projectId, reserved + estimatedCost);
  return () => {
    const next = (pending.get(projectId) ?? estimatedCost) - estimatedCost;
    if (next > 0) pending.set(projectId, next); else pending.delete(projectId);
  };
};
