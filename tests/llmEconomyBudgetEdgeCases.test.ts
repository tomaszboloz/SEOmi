import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as storageModule from '@/services/storage';
import {
  clearProjectLlmBudgetAndSpend,
  llmBudgetStatus,
  readLlmBudget,
  readLlmSpend,
  recordLlmCost,
  withinProjectBudget,
  writeLlmBudget,
} from '@/services/llmEconomy/llmBudget';

const P = 'p_edge_cases';
const oct = new Date(2026, 9, 20);

beforeEach(() => {
  localStorage.clear();
});

describe('llmBudget edge cases and fault tolerance', () => {
  it('handles array, null, and corrupt JSON in storage safely', () => {
    localStorage.setItem(`seomi_project_${P}_llm_budget_v1`, '["not", "an", "object"]');
    expect(readLlmBudget(P)).toEqual({ monthlyLimitUsd: null, warnAtPercent: 80 });

    localStorage.setItem(`seomi_project_${P}_llm_budget_v1`, '{bad json');
    expect(readLlmBudget(P)).toEqual({ monthlyLimitUsd: null, warnAtPercent: 80 });

    localStorage.setItem(`seomi_project_${P}_llm_spend_v1`, 'null');
    expect(readLlmSpend(P, oct)).toMatchObject({ spentUsd: 0, calls: 0, lastCall: null });

    localStorage.setItem(`seomi_project_${P}_llm_spend_v1`, '{corrupt');
    expect(readLlmSpend(P, oct)).toMatchObject({ spentUsd: 0, calls: 0, lastCall: null });
  });

  it('tolerates partial lastCall and non-integer counters in spend record', () => {
    localStorage.setItem(
      `seomi_project_${P}_llm_spend_v1`,
      JSON.stringify({
        month: '2026-10',
        spentUsd: 1.5,
        savedUsd: 0.5,
        cacheHits: 'invalid',
        calls: null,
        lastCostByProvider: { openai: 1.5, bad: 'text' },
        lastCall: { providerId: 'openai', costUsd: 1.5, at: '2026-10-20T10:00:00.000Z' },
      }),
    );
    const spend = readLlmSpend(P, oct);
    expect(spend.calls).toBe(0);
    expect(spend.cacheHits).toBe(0);
    expect(spend.lastCostByProvider).toEqual({ openai: 1.5 });
    expect(spend.lastCall?.providerId).toBe('openai');
    expect(spend.lastCall?.model).toBeUndefined();

    localStorage.setItem(
      `seomi_project_${P}_llm_spend_v1`,
      JSON.stringify({ month: '2026-10', lastCall: { providerId: 'openai', costUsd: -1, at: 123 } }),
    );
    expect(readLlmSpend(P, oct).lastCall).toBeNull();
  });

  it('handles zero budget limit edge cases and ok status level', () => {
    const zeroSpend = { month: '2026-10', spentUsd: 0, savedUsd: 0, cacheHits: 0, calls: 0, lastCostByProvider: {}, lastCall: null };
    const positiveSpend = { ...zeroSpend, spentUsd: 0.01 };
    const zeroBudget = { monthlyLimitUsd: 0, warnAtPercent: 80 };

    expect(llmBudgetStatus(zeroSpend, zeroBudget)).toEqual({ level: 'exceeded', percent: 0, remainingUsd: 0 });
    expect(llmBudgetStatus(positiveSpend, zeroBudget)).toEqual({ level: 'exceeded', percent: 100, remainingUsd: 0 });
    expect(llmBudgetStatus({ ...zeroSpend, spentUsd: 4 }, { monthlyLimitUsd: 10, warnAtPercent: 80 })).toEqual({ level: 'ok', percent: 40, remainingUsd: 6 });
  });

  it('falls back to raw cost when local call does not specify savedUsd and handles non-finite cost', () => {
    recordLlmCost(P, { providerId: 'ollama', costUsd: 0.07, local: true }, oct);
    expect(readLlmSpend(P, oct).savedUsd).toBe(0.07);

    recordLlmCost(P, { providerId: 'openai', costUsd: Number.NaN }, oct);
    expect(readLlmSpend(P, oct).calls).toBe(2);
  });

  it('survives storage write failure gracefully', () => {
    const spy = vi.spyOn(storageModule, 'writeStorage').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => recordLlmCost(P, { providerId: 'openai', costUsd: 0.1 }, oct)).not.toThrow();
    spy.mockRestore();
  });

  it('clears budget and spend via clearProjectLlmBudgetAndSpend', () => {
    writeLlmBudget(P, { monthlyLimitUsd: 15, warnAtPercent: 80 });
    recordLlmCost(P, { providerId: 'openai', costUsd: 2 });
    clearProjectLlmBudgetAndSpend(P);
    expect(readLlmBudget(P).monthlyLimitUsd).toBeNull();
    expect(readLlmSpend(P).spentUsd).toBe(0);
  });

  it('checks budget without specifying date argument', () => {
    expect(withinProjectBudget(P, 5)).toBe(true);
  });

  it('covers null budget status, null cost in withinProjectBudget, and cached call with null cost', () => {
    const zeroSpend = { month: '2026-10', spentUsd: 0, savedUsd: 0, cacheHits: 0, calls: 0, lastCostByProvider: {}, lastCall: null };
    expect(llmBudgetStatus(zeroSpend, { monthlyLimitUsd: null, warnAtPercent: 80 })).toEqual({ level: 'none', percent: null, remainingUsd: null });

    writeLlmBudget(P, { monthlyLimitUsd: 10, warnAtPercent: 80 });
    expect(withinProjectBudget(P, null)).toBe(false);

    recordLlmCost(P, { providerId: 'openai', costUsd: null, cached: true }, oct);
    expect(readLlmSpend(P, oct).calls).toBe(1);
  });
});
