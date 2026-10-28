import i18n from '@/i18n';
import { isStorageAvailable, readStorage, removeStorage, writeStorage } from '@/services/storage';
import type { UsageSummary } from './costMeter';

export const LLM_ECONOMY_EVENT = 'seomi:llm-economy-cost';
export const MAX_LLM_MONTHLY_LIMIT_USD = 100_000;

export interface LlmBudget { monthlyLimitUsd: number | null; warnAtPercent: number }
export interface LlmLastCall { providerId: string; model?: string; costUsd: number | null; savedUsd: number; cached: boolean; local: boolean; at: string }
export interface LlmSpend {
  month: string; spentUsd: number; savedUsd: number; cacheHits: number; calls: number;
  unknownCostCalls?: number;
  lastCostByProvider: Record<string, number>; lastCall: LlmLastCall | null;
}
export type BudgetLevel = 'none' | 'ok' | 'warning' | 'exceeded';
export type LlmStorageState = 'missing' | 'valid' | 'invalid' | 'unavailable';

const budgetKey = (p: string) => `seomi_project_${p}_llm_budget_v1`;
const spendKey = (p: string) => `seomi_project_${p}_llm_spend_v1`;
const DEFAULT_BUDGET: LlmBudget = { monthlyLimitUsd: null, warnAtPercent: 80 };

const isPlainObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const validBudgetShape = (value: Record<string, unknown>): boolean =>
  (!('monthlyLimitUsd' in value) || value.monthlyLimitUsd === null || finiteCost(value.monthlyLimitUsd))
  && (!('warnAtPercent' in value) || (typeof value.warnAtPercent === 'number' && Number.isInteger(value.warnAtPercent) && value.warnAtPercent >= 1 && value.warnAtPercent <= 100));
const validSpendShape = (value: Record<string, unknown>): boolean => {
  const numeric = ['spentUsd', 'savedUsd'];
  const counters = ['cacheHits', 'calls', 'unknownCostCalls'];
  const providerCosts = !('lastCostByProvider' in value) || (isPlainObject(value.lastCostByProvider)
    && Object.values(value.lastCostByProvider).every((cost) => finiteCost(cost)));
  const lastCall = !('lastCall' in value) || value.lastCall === null || isPlainObject(value.lastCall);
  return (!('month' in value) || typeof value.month === 'string')
    && numeric.every((key) => !(key in value) || finiteCost(value[key]))
    && counters.every((key) => !(key in value) || (typeof value[key] === 'number' && Number.isInteger(value[key]) && (value[key] as number) >= 0))
    && providerCosts && lastCall;
};

const storageState = (key: string, kind: 'budget' | 'spend'): LlmStorageState => {
  if (!isStorageAvailable()) return 'unavailable';
  const raw = readStorage(key);
  if (raw === null) return 'missing';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return 'invalid';
    return (kind === 'budget' ? validBudgetShape(parsed) : validSpendShape(parsed)) ? 'valid' : 'invalid';
  } catch { return 'invalid'; }
};

export const readLlmStorageState = (projectId: string): { budget: LlmStorageState; spend: LlmStorageState } => ({
  budget: storageState(budgetKey(projectId), 'budget'),
  spend: storageState(spendKey(projectId), 'spend'),
});

export const monthKey = (now = new Date()): string => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const finiteCost = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_LLM_MONTHLY_LIMIT_USD;

const readJson = (key: string): Record<string, unknown> => {
  try {
    const val: unknown = JSON.parse(readStorage(key) || '{}');
    return val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
  } catch { return {}; }
};

export const readLlmBudget = (projectId: string): LlmBudget => {
  const s = readJson(budgetKey(projectId));
  return {
    monthlyLimitUsd: finiteCost(s.monthlyLimitUsd) ? s.monthlyLimitUsd : null,
    warnAtPercent: typeof s.warnAtPercent === 'number' && Number.isInteger(s.warnAtPercent) && s.warnAtPercent >= 1 && s.warnAtPercent <= 100 ? s.warnAtPercent : DEFAULT_BUDGET.warnAtPercent,
  };
};

export const writeLlmBudget = (projectId: string, budget: LlmBudget): LlmBudget => {
  if (budget.monthlyLimitUsd !== null && !(finiteCost(budget.monthlyLimitUsd) && budget.monthlyLimitUsd <= MAX_LLM_MONTHLY_LIMIT_USD)) throw new Error(i18n.t('dataforseoCost.invalidLimit'));
  if (!Number.isInteger(budget.warnAtPercent) || budget.warnAtPercent < 1 || budget.warnAtPercent > 100) throw new Error(i18n.t('dataforseoCost.invalidWarn'));
  if (!writeStorage(budgetKey(projectId), JSON.stringify(budget))) throw new Error('Unable to persist the project LLM budget');
  window.dispatchEvent(new CustomEvent(LLM_ECONOMY_EVENT, { detail: { projectId, budget } }));
  return budget;
};

export const clearProjectLlmBudgetAndSpend = (projectId: string): void => {
  removeStorage(budgetKey(projectId));
  removeStorage(spendKey(projectId));
  window.dispatchEvent(new CustomEvent(LLM_ECONOMY_EVENT, { detail: { projectId, cleared: true } }));
};

export const readLlmSpend = (projectId: string, now = new Date()): LlmSpend => {
  const s = readJson(spendKey(projectId));
  const month = monthKey(now);
  const costs = s.lastCostByProvider && typeof s.lastCostByProvider === 'object' ? (s.lastCostByProvider as Record<string, unknown>) : {};
  const lastCostByProvider = Object.fromEntries(Object.entries(costs).filter((e): e is [string, number] => finiteCost(e[1])).slice(0, 50));
  const last = s.lastCall as Partial<LlmLastCall> | undefined;
  const lastCost = last && (last.costUsd === null || finiteCost(last.costUsd)) ? last.costUsd : null;
  const lastCall: LlmLastCall | null = last && typeof last.providerId === 'string' && (last.costUsd === null || finiteCost(last.costUsd)) && typeof last.at === 'string'
    ? { providerId: last.providerId, model: typeof last.model === 'string' ? last.model : undefined, costUsd: lastCost, savedUsd: finiteCost(last.savedUsd) ? last.savedUsd : 0, cached: Boolean(last.cached), local: Boolean(last.local), at: last.at }
    : null;
  if (s.month !== month) return { month, spentUsd: 0, savedUsd: 0, cacheHits: 0, calls: 0, lastCostByProvider, lastCall };
  return {
    month, spentUsd: finiteCost(s.spentUsd) ? s.spentUsd : 0, savedUsd: finiteCost(s.savedUsd) ? s.savedUsd : 0,
    cacheHits: typeof s.cacheHits === 'number' && Number.isInteger(s.cacheHits) && s.cacheHits >= 0 ? s.cacheHits : 0,
    calls: typeof s.calls === 'number' && Number.isInteger(s.calls) && s.calls >= 0 ? s.calls : 0,
    lastCostByProvider, lastCall, ...(typeof s.unknownCostCalls === 'number' && Number.isInteger(s.unknownCostCalls) && s.unknownCostCalls > 0 ? { unknownCostCalls: s.unknownCostCalls } : {}),
  };
};

export const recordLlmCost = (
  projectId: string,
  entry: { providerId: string; model?: string; costUsd: number | null; savedUsd?: number; cached?: boolean; local?: boolean },
  now = new Date(),
): LlmSpend => {
  const spend = readLlmSpend(projectId, now);
  const cached = Boolean(entry.cached);
  const local = Boolean(entry.local);
  const cost = entry.costUsd === null ? null : (finiteCost(entry.costUsd) ? entry.costUsd : null);
  const spentDiff = cached || local || cost === null ? 0 : cost;
  const savedDiff = cached || local ? (finiteCost(entry.savedUsd) ? entry.savedUsd : (cost ?? 0)) : 0;
  const next: LlmSpend = {
    ...spend,
    spentUsd: Math.round((spend.spentUsd + spentDiff) * 1e6) / 1e6,
    savedUsd: Math.round((spend.savedUsd + savedDiff) * 1e6) / 1e6,
    cacheHits: spend.cacheHits + (cached ? 1 : 0),
    calls: spend.calls + 1,
    lastCostByProvider: cost !== null ? { ...spend.lastCostByProvider, [entry.providerId]: cost } : spend.lastCostByProvider,
    lastCall: { providerId: entry.providerId, model: entry.model, costUsd: cost, savedUsd: savedDiff, cached, local, at: now.toISOString() },
    ...(cost === null && !cached && !local ? { unknownCostCalls: (spend.unknownCostCalls ?? 0) + 1 } : spend.unknownCostCalls ? { unknownCostCalls: spend.unknownCostCalls } : {}),
  };
  try { writeStorage(spendKey(projectId), JSON.stringify(next)); } catch { /* Storage fallback */ }
  window.dispatchEvent(new CustomEvent(LLM_ECONOMY_EVENT, { detail: { projectId, entry } }));
  return next;
};

export const llmBudgetStatus = (spend: LlmSpend, budget: LlmBudget): { level: BudgetLevel; percent: number | null; remainingUsd: number | null } => {
  if (budget.monthlyLimitUsd === null) return { level: 'none', percent: null, remainingUsd: null };
  const limit = budget.monthlyLimitUsd;
  const percent = limit === 0 ? (spend.spentUsd > 0 ? 100 : 0) : Math.min(999, (spend.spentUsd / limit) * 100);
  const level: BudgetLevel = spend.spentUsd >= limit ? 'exceeded' : percent >= budget.warnAtPercent ? 'warning' : 'ok';
  return { level, percent, remainingUsd: Math.max(0, Math.round((limit - spend.spentUsd) * 1e6) / 1e6) };
};

export const withinProjectBudget = (projectId: string, nextCostUsd: number | null, now = new Date()): boolean => {
  const budget = readLlmBudget(projectId);
  if (budget.monthlyLimitUsd === null) return true;
  if (nextCostUsd === null) return false;
  return readLlmSpend(projectId, now).spentUsd + nextCostUsd <= budget.monthlyLimitUsd;
};
export const readLlmUsageSummary = (projectId: string, now = new Date()): UsageSummary => {
  const spend = readLlmSpend(projectId, now);
  const budget = readLlmBudget(projectId);
  const status = llmBudgetStatus(spend, budget);
  return { spentUsd: spend.spentUsd, savedUsd: spend.savedUsd, cacheHits: spend.cacheHits, calls: spend.calls, remainingUsd: status.remainingUsd, overBudget: status.level === 'exceeded', ...(spend.unknownCostCalls ? { unknownCostCalls: spend.unknownCostCalls } : {}) };
};
