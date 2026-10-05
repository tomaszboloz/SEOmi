import { readStorage, writeStorage } from '@/services/storage';
import { DATAFORSEO_COST_EVENT } from './dataforseoBudget';
import type { JsonRecord } from './dataforseoTypes';

export interface DataForSeoAccount {
  login: string | null;
  /** Balance reported by DataForSEO at `fetchedAt`, in USD. */
  balanceUsd: number;
  /** Balance minus costs of requests made since `fetchedAt`. */
  estimatedBalanceUsd: number;
  /** Provider-side daily spending limit, when the account has one. */
  dailyLimitUsd: number | null;
  fetchedAt: string;
}

const accountKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_account_v1`;
const asRecord = (value: unknown): JsonRecord => (value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {});
const money = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Reads `/v3/appendix/user_data`; the account object sits in `tasks[0].result[0]`. */
export const parseUserData = (body: JsonRecord, fetchedAt = new Date().toISOString()): DataForSeoAccount | null => {
  const task = asRecord(Array.isArray(body.tasks) ? body.tasks[0] : undefined);
  const result = asRecord(Array.isArray(task.result) ? task.result[0] : undefined);
  const funds = asRecord(result.money);
  const balance = money(funds.balance);
  if (balance === null) return null;
  const daily = money(asRecord(asRecord(funds.limits).day).total_value) ?? money(asRecord(funds.limits).day);
  return {
    login: typeof result.login === 'string' ? result.login : null,
    balanceUsd: balance,
    estimatedBalanceUsd: balance,
    dailyLimitUsd: daily !== null && daily > 0 ? daily : null,
    fetchedAt,
  };
};

export const readAccount = (projectId: string): DataForSeoAccount | null => {
  try {
    const stored = asRecord(JSON.parse(readStorage(accountKey(projectId)) || '{}'));
    if (money(stored.balanceUsd) === null || money(stored.estimatedBalanceUsd) === null || typeof stored.fetchedAt !== 'string') return null;
    return {
      login: typeof stored.login === 'string' ? stored.login : null,
      balanceUsd: stored.balanceUsd as number,
      estimatedBalanceUsd: stored.estimatedBalanceUsd as number,
      dailyLimitUsd: money(stored.dailyLimitUsd),
      fetchedAt: stored.fetchedAt,
    };
  } catch {
    return null;
  }
};

export const writeAccount = (projectId: string, account: DataForSeoAccount): void => {
  try {
    writeStorage(accountKey(projectId), JSON.stringify(account));
  } catch {
    // Display state only.
  }
  window.dispatchEvent(new Event(DATAFORSEO_COST_EVENT));
};

/** Keeps the shown balance current between explicit account checks. */
export const deductFromAccount = (projectId: string, costUsd: number): void => {
  const account = readAccount(projectId);
  if (!account || !(costUsd > 0)) return;
  writeAccount(projectId, { ...account, estimatedBalanceUsd: Math.round((account.estimatedBalanceUsd - costUsd) * 1e6) / 1e6 });
};
