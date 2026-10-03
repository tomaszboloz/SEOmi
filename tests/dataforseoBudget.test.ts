import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { budgetStatus, monthKey, readBudget, readSpend, recordCost, writeBudget, DATAFORSEO_COST_EVENT, ACCOUNT_ENDPOINT } from '@/services/dataforseo/dataforseoBudget';
import { DataForSeoBudgetError, reserveBudget } from '@/services/dataforseo/dataforseoBudgetGuard';
import { deductFromAccount, parseUserData, readAccount, writeAccount } from '@/services/dataforseo/dataforseoAccount';

const P = 'p1';
const SERP = '/v3/serp/google/organic/live/regular';
const oct = new Date(2026, 9, 3, 12);
beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(() => vi.restoreAllMocks());

describe('budget settings', () => {
  it('defaults to no monthly limit and an 80% warning', () => {
    expect(readBudget(P)).toEqual({ monthlyLimitUsd: null, warnAtPercent: 80 });
  });

  it('stores valid limits and rejects invalid ones', () => {
    expect(writeBudget(P, { monthlyLimitUsd: 10, warnAtPercent: 90 })).toEqual({ monthlyLimitUsd: 10, warnAtPercent: 90 });
    expect(readBudget(P)).toEqual({ monthlyLimitUsd: 10, warnAtPercent: 90 });
    expect(() => writeBudget(P, { monthlyLimitUsd: -1, warnAtPercent: 80 })).toThrow(i18n.t('dataforseoCost.invalidLimit'));
    expect(() => writeBudget(P, { monthlyLimitUsd: 1e9, warnAtPercent: 80 })).toThrow();
    expect(() => writeBudget(P, { monthlyLimitUsd: 5, warnAtPercent: 0 })).toThrow(i18n.t('dataforseoCost.invalidWarn'));
    localStorage.setItem('seomi_project_p1_dataforseo_budget_v1', '{"monthlyLimitUsd":"x","warnAtPercent":500}');
    expect(readBudget(P)).toEqual({ monthlyLimitUsd: null, warnAtPercent: 80 });
  });
});

describe('monthly spend', () => {
  it('adds reported costs without float drift and announces each call', () => {
    const listener = vi.fn();
    window.addEventListener(DATAFORSEO_COST_EVENT, listener);
    for (let index = 0; index < 10; index += 1) recordCost(P, SERP, 0.0006, oct);
    window.removeEventListener(DATAFORSEO_COST_EVENT, listener);
    const spend = readSpend(P, oct);
    expect(spend).toMatchObject({ month: '2026-10', totalUsd: 0.006, calls: 10, lastCostByEndpoint: { [SERP]: 0.0006 } });
    expect(spend.lastCall).toMatchObject({ endpoint: SERP, costUsd: 0.0006 });
    expect(listener).toHaveBeenCalledTimes(10);
  });

  it('starts a new month from zero but keeps the last observed endpoint costs', () => {
    recordCost(P, SERP, 2, new Date(2026, 8, 30));
    expect(readSpend(P, oct)).toMatchObject({ month: monthKey(oct), totalUsd: 0, calls: 0, lastCostByEndpoint: { [SERP]: 2 } });
  });

  it('treats invalid reported costs as zero and survives corrupted storage', () => {
    recordCost(P, SERP, Number.NaN, oct);
    expect(readSpend(P, oct).totalUsd).toBe(0);
    localStorage.setItem('seomi_project_p1_dataforseo_spend_v1', '{bad');
    expect(readSpend(P, oct)).toMatchObject({ totalUsd: 0, calls: 0, lastCall: null });
  });

  it('reports warning and exceeded levels', () => {
    const spend = (totalUsd: number) => ({ month: '2026-10', totalUsd, calls: 1, lastCostByEndpoint: {}, lastCall: null });
    expect(budgetStatus(spend(5), { monthlyLimitUsd: null, warnAtPercent: 80 }).level).toBe('none');
    expect(budgetStatus(spend(5), { monthlyLimitUsd: 10, warnAtPercent: 80 })).toEqual({ level: 'ok', percent: 50, remainingUsd: 5 });
    expect(budgetStatus(spend(8), { monthlyLimitUsd: 10, warnAtPercent: 80 }).level).toBe('warning');
    expect(budgetStatus(spend(10), { monthlyLimitUsd: 10, warnAtPercent: 80 })).toMatchObject({ level: 'exceeded', remainingUsd: 0 });
    expect(budgetStatus(spend(0), { monthlyLimitUsd: 0, warnAtPercent: 80 }).level).toBe('exceeded');
  });
});

describe('budget guard', () => {
  it('blocks when the cap is used or the next expected call would exceed it, including calls in flight', () => {
    writeBudget(P, { monthlyLimitUsd: 0.01, warnAtPercent: 80 });
    recordCost(P, SERP, 0.004, oct);
    const first = reserveBudget(P, SERP, oct);
    expect(() => reserveBudget(P, SERP, oct)).toThrow(DataForSeoBudgetError);
    first();
    first();
    expect(() => reserveBudget(P, SERP, oct)()).not.toThrow();
    recordCost(P, SERP, 0.006, oct);
    expect(() => reserveBudget(P, '/v3/backlinks/summary/live', oct)).toThrow(/monthly limit reached/);
  });

  it('never blocks the free account endpoint or a missing project', () => {
    writeBudget(P, { monthlyLimitUsd: 0, warnAtPercent: 80 });
    expect(() => reserveBudget(P, ACCOUNT_ENDPOINT, oct)()).not.toThrow();
    expect(() => reserveBudget(null, SERP, oct)()).not.toThrow();
  });

  it('without a monthly limit uses the account balance as the limit', () => {
    expect(() => reserveBudget(P, SERP, oct)()).not.toThrow();
    writeAccount(P, { login: 'x', balanceUsd: 0.005, estimatedBalanceUsd: 0.005, dailyLimitUsd: null, fetchedAt: oct.toISOString() });
    recordCost(P, SERP, 0.004, oct);
    deductFromAccount(P, 0.004);
    expect(() => reserveBudget(P, SERP, oct)).toThrow(/balance is used up/);
  });
});

describe('account balance', () => {
  it('parses user_data and keeps an estimate after later calls', () => {
    const account = parseUserData({ tasks: [{ result: [{ login: 'me', money: { balance: 12.5, limits: { day: { total_value: 5 } } } }] }] }, oct.toISOString());
    expect(account).toEqual({ login: 'me', balanceUsd: 12.5, estimatedBalanceUsd: 12.5, dailyLimitUsd: 5, fetchedAt: oct.toISOString() });
    writeAccount(P, account!);
    deductFromAccount(P, 0.25);
    deductFromAccount(P, -1);
    expect(readAccount(P)).toMatchObject({ balanceUsd: 12.5, estimatedBalanceUsd: 12.25 });
  });

  it('returns nothing for responses without a balance or corrupted storage', () => {
    expect(parseUserData({ tasks: [{ result: [{ money: {} }] }] })).toBeNull();
    expect(parseUserData({})).toBeNull();
    localStorage.setItem('seomi_project_p1_dataforseo_account_v1', '[]');
    expect(readAccount(P)).toBeNull();
    deductFromAccount('none', 1);
  });
});
