import i18n from '@/i18n';
import { ACCOUNT_ENDPOINT, readBudget, readSpend } from './dataforseoBudget';
import { readAccount } from './dataforseoAccount';

export class DataForSeoBudgetError extends Error {
  constructor(message: string, readonly spentUsd: number, readonly limitUsd: number) {
    super(message);
    this.name = 'DataForSeoBudgetError';
  }
}

// Expected cost of requests already sent but not yet answered, per project, so
// parallel requests cannot all pass the check and overshoot the cap together.
const reserved = new Map<string, number>();

/**
 * Blocks a paid request before it is sent when the monthly cap is reached, or
 * when the last observed cost of the same endpoint (plus requests still in
 * flight) would exceed what is left. Returns a release function to call when
 * the request settles.
 */
export const reserveBudget = (projectId: string | null, endpoint: string, now = new Date()): (() => void) => {
  if (!projectId || endpoint === ACCOUNT_ENDPOINT) return () => undefined;
  const budget = readBudget(projectId);
  const spend = readSpend(projectId, now);
  const expected = spend.lastCostByEndpoint[endpoint] ?? 0;
  const pending = reserved.get(projectId) ?? 0;
  if (budget.monthlyLimitUsd === null) {
    // "No limit" means the account balance is the limit. It is enforced only
    // once a balance has been read; DataForSEO itself rejects unfunded calls.
    const account = readAccount(projectId);
    if (account && (account.estimatedBalanceUsd <= 0 || account.estimatedBalanceUsd < pending + expected)) {
      throw new DataForSeoBudgetError(
        i18n.t('dataforseoCost.balanceExhausted', { balance: account.estimatedBalanceUsd.toFixed(4), expected: (pending + expected).toFixed(4) }),
        spend.totalUsd,
        account.estimatedBalanceUsd,
      );
    }
    reserved.set(projectId, pending + expected);
    return releaser(projectId, expected);
  }
  if (spend.totalUsd >= budget.monthlyLimitUsd || spend.totalUsd + pending + expected > budget.monthlyLimitUsd) {
    throw new DataForSeoBudgetError(
      i18n.t('dataforseoCost.limitReached', { spent: spend.totalUsd.toFixed(4), limit: budget.monthlyLimitUsd.toFixed(2), expected: (pending + expected).toFixed(4) }),
      spend.totalUsd,
      budget.monthlyLimitUsd,
    );
  }
  reserved.set(projectId, pending + expected);
  return releaser(projectId, expected);
};

const releaser = (projectId: string, expected: number): (() => void) => {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (reserved.get(projectId) ?? 0) - expected;
    if (left > 1e-9) reserved.set(projectId, left);
    else reserved.delete(projectId);
  };
};
