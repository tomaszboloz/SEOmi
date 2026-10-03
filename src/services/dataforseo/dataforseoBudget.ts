import i18n from '@/i18n';
import { readStorage, writeStorage } from '@/services/storage';

/** Endpoint that reports the account and is free; never blocked by the budget. */
export const ACCOUNT_ENDPOINT = '/v3/appendix/user_data';
export const DATAFORSEO_COST_EVENT = 'seomi:dataforseo-cost';
export const MAX_MONTHLY_LIMIT_USD = 100_000;

export interface DataForSeoBudget {
  /** Spending cap for the current calendar month in USD; null = no cap. */
  monthlyLimitUsd: number | null;
  /** Show a warning once this share of the cap is used (1–100). */
  warnAtPercent: number;
}

export interface DataForSeoLastCall {
  endpoint: string;
  costUsd: number;
  at: string;
}

export interface DataForSeoSpend {
  /** Calendar month (local time) the totals belong to, e.g. `2026-10`. */
  month: string;
  totalUsd: number;
  calls: number;
  /** Last observed cost per endpoint; used to predict the next call. */
  lastCostByEndpoint: Record<string, number>;
  lastCall: DataForSeoLastCall | null;
}

export type BudgetLevel = 'none' | 'ok' | 'warning' | 'exceeded';

const budgetKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_budget_v1`;
const spendKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_spend_v1`;
const DEFAULT_BUDGET: DataForSeoBudget = { monthlyLimitUsd: null, warnAtPercent: 80 };

export const monthKey = (now = new Date()): string => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const finiteCost = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < MAX_MONTHLY_LIMIT_USD;
const readJson = (key: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(readStorage(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

export const readBudget = (projectId: string): DataForSeoBudget => {
  const stored = readJson(budgetKey(projectId));
  const limit = stored.monthlyLimitUsd;
  const warn = stored.warnAtPercent;
  return {
    monthlyLimitUsd: finiteCost(limit) ? limit : null,
    warnAtPercent: typeof warn === 'number' && Number.isInteger(warn) && warn >= 1 && warn <= 100 ? warn : DEFAULT_BUDGET.warnAtPercent,
  };
};

export const writeBudget = (projectId: string, budget: DataForSeoBudget): DataForSeoBudget => {
  if (budget.monthlyLimitUsd !== null && !(finiteCost(budget.monthlyLimitUsd) && budget.monthlyLimitUsd <= MAX_MONTHLY_LIMIT_USD)) throw new Error(i18n.t('dataforseoCost.invalidLimit'));
  if (!Number.isInteger(budget.warnAtPercent) || budget.warnAtPercent < 1 || budget.warnAtPercent > 100) throw new Error(i18n.t('dataforseoCost.invalidWarn'));
  writeStorage(budgetKey(projectId), JSON.stringify(budget));
  window.dispatchEvent(new Event(DATAFORSEO_COST_EVENT));
  return budget;
};

/** Spend for the current month; a stored month that has ended starts again from zero. */
export const readSpend = (projectId: string, now = new Date()): DataForSeoSpend => {
  const stored = readJson(spendKey(projectId));
  const month = monthKey(now);
  const costs = stored.lastCostByEndpoint && typeof stored.lastCostByEndpoint === 'object' ? stored.lastCostByEndpoint as Record<string, unknown> : {};
  const lastCostByEndpoint = Object.fromEntries(Object.entries(costs).filter((entry): entry is [string, number] => finiteCost(entry[1])).slice(0, 100));
  const last = stored.lastCall as Partial<DataForSeoLastCall> | undefined;
  const lastCall = last && typeof last.endpoint === 'string' && finiteCost(last.costUsd) && typeof last.at === 'string' ? { endpoint: last.endpoint, costUsd: last.costUsd, at: last.at } : null;
  if (stored.month !== month) return { month, totalUsd: 0, calls: 0, lastCostByEndpoint, lastCall };
  return {
    month,
    totalUsd: finiteCost(stored.totalUsd) ? stored.totalUsd : 0,
    calls: typeof stored.calls === 'number' && Number.isInteger(stored.calls) && stored.calls >= 0 ? stored.calls : 0,
    lastCostByEndpoint,
    lastCall,
  };
};

/** Adds the cost DataForSEO reported for one request and notifies cost meters. */
export const recordCost = (projectId: string, endpoint: string, costUsd: number, now = new Date()): DataForSeoSpend => {
  const spend = readSpend(projectId, now);
  const cost = finiteCost(costUsd) ? costUsd : 0;
  const next: DataForSeoSpend = {
    ...spend,
    // Integer micro-dollars avoid floating-point drift over thousands of calls.
    totalUsd: Math.round((spend.totalUsd + cost) * 1e6) / 1e6,
    calls: spend.calls + 1,
    lastCostByEndpoint: { ...spend.lastCostByEndpoint, [endpoint]: cost },
    lastCall: { endpoint, costUsd: cost, at: now.toISOString() },
  };
  try {
    writeStorage(spendKey(projectId), JSON.stringify(next));
  } catch {
    // The request already succeeded; a full storage quota must not hide its data.
  }
  window.dispatchEvent(new CustomEvent(DATAFORSEO_COST_EVENT, { detail: { projectId, endpoint, costUsd: cost } }));
  return next;
};

export const budgetStatus = (spend: DataForSeoSpend, budget: DataForSeoBudget): { level: BudgetLevel; percent: number | null; remainingUsd: number | null } => {
  if (budget.monthlyLimitUsd === null) return { level: 'none', percent: null, remainingUsd: null };
  const limit = budget.monthlyLimitUsd;
  const percent = limit === 0 ? (spend.totalUsd > 0 ? 100 : 0) : Math.min(999, (spend.totalUsd / limit) * 100);
  const level: BudgetLevel = spend.totalUsd >= limit ? 'exceeded' : percent >= budget.warnAtPercent ? 'warning' : 'ok';
  return { level, percent, remainingUsd: Math.max(0, Math.round((limit - spend.totalUsd) * 1e6) / 1e6) };
};
