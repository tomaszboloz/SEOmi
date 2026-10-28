import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import {
  llmBudgetStatus, monthKey, readLlmBudget, readLlmSpend, readLlmUsageSummary,
  recordLlmCost, withinProjectBudget, writeLlmBudget, LLM_ECONOMY_EVENT,
} from '@/services/llmEconomy/llmBudget';

const P = 'proj_test_1';
const oct = new Date(2026, 9, 15, 12);

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
});
afterEach(() => vi.restoreAllMocks());

describe('llmBudget settings', () => {
  it('defaults to no monthly limit and 80% warning', () => {
    expect(readLlmBudget(P)).toEqual({ monthlyLimitUsd: null, warnAtPercent: 80 });
  });

  it('writes valid limits and rejects invalid ones', () => {
    expect(writeLlmBudget(P, { monthlyLimitUsd: 50, warnAtPercent: 90 })).toEqual({ monthlyLimitUsd: 50, warnAtPercent: 90 });
    expect(readLlmBudget(P)).toEqual({ monthlyLimitUsd: 50, warnAtPercent: 90 });
    expect(() => writeLlmBudget(P, { monthlyLimitUsd: -5, warnAtPercent: 80 })).toThrow();
    expect(() => writeLlmBudget(P, { monthlyLimitUsd: 200_000, warnAtPercent: 80 })).toThrow();
    expect(() => writeLlmBudget(P, { monthlyLimitUsd: 10, warnAtPercent: 0 })).toThrow();
    expect(() => writeLlmBudget(P, { monthlyLimitUsd: 10, warnAtPercent: 101 })).toThrow();
    localStorage.setItem(`seomi_project_${P}_llm_budget_v1`, '{"monthlyLimitUsd":"bad"}');
    expect(readLlmBudget(P)).toEqual({ monthlyLimitUsd: null, warnAtPercent: 80 });
  });
});

describe('llmSpend tracking and privacy', () => {
  it('records spend, savings and cache hits without leaking private text to storage', () => {
    const listener = vi.fn();
    window.addEventListener(LLM_ECONOMY_EVENT, listener);
    recordLlmCost(P, { providerId: 'openai', model: 'gpt-4o', costUsd: 0.05 }, oct);
    recordLlmCost(P, { providerId: 'ollama', model: 'llama3', costUsd: 0.02, local: true }, oct);
    recordLlmCost(P, { providerId: 'openai', model: 'gpt-4o', costUsd: 0.05, savedUsd: 0.05, cached: true }, oct);
    window.removeEventListener(LLM_ECONOMY_EVENT, listener);

    const spend = readLlmSpend(P, oct);
    expect(spend.month).toBe('2026-10');
    expect(spend.spentUsd).toBe(0.05);
    expect(spend.savedUsd).toBe(0.07);
    expect(spend.cacheHits).toBe(1);
    expect(spend.calls).toBe(3);
    expect(spend.lastCostByProvider.openai).toBe(0.05);
    expect(spend.lastCall?.providerId).toBe('openai');
    expect(spend.lastCall?.cached).toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);

    const rawStored = localStorage.getItem(`seomi_project_${P}_llm_spend_v1`) ?? '';
    expect(rawStored).not.toContain('prompt');
    expect(rawStored).not.toContain('secret');
  });

  it('resets month-to-date counters across new months while keeping provider costs', () => {
    recordLlmCost(P, { providerId: 'claude', costUsd: 1.5 }, new Date(2026, 8, 30));
    const next = readLlmSpend(P, oct);
    expect(next.month).toBe(monthKey(oct));
    expect(next.spentUsd).toBe(0);
    expect(next.calls).toBe(0);
    expect(next.lastCostByProvider.claude).toBe(1.5);
  });

  it('reports status levels and guards next calls', () => {
    writeLlmBudget(P, { monthlyLimitUsd: 10, warnAtPercent: 80 });
    expect(withinProjectBudget(P, 5)).toBe(true);
    recordLlmCost(P, { providerId: 'openai', costUsd: 8.5 }, oct);
    const spend = readLlmSpend(P, oct);
    const budget = readLlmBudget(P);
    const status = llmBudgetStatus(spend, budget);
    expect(status.level).toBe('warning');
    expect(status.remainingUsd).toBe(1.5);
    expect(withinProjectBudget(P, 2)).toBe(false);

    recordLlmCost(P, { providerId: 'openai', costUsd: 2 }, oct);
    expect(llmBudgetStatus(readLlmSpend(P, oct), budget).level).toBe('exceeded');
  });

  it('produces a summary compatible with costMeter', () => {
    writeLlmBudget(P, { monthlyLimitUsd: 10, warnAtPercent: 80 });
    recordLlmCost(P, { providerId: 'openai', costUsd: 2, savedUsd: 1, cached: true }, oct);
    const summary = readLlmUsageSummary(P, oct);
    expect(summary).toEqual({
      spentUsd: 0,
      savedUsd: 1,
      cacheHits: 1,
      calls: 1,
      remainingUsd: 10,
      overBudget: false,
    });
  });
});
