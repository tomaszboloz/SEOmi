import { beforeEach, describe, expect, it } from 'vitest';
import { monthKey, recordCost, writeBudget } from '@/services/dataforseo/dataforseoBudget';
import { DataForSeoBudgetError, nativeBudget, reserveBudget, UNSEEN_ENDPOINT_ESTIMATE_USD } from '@/services/dataforseo/dataforseoBudgetGuard';

const P = 'p1';
const SERP = '/v3/serp/google/organic/live/regular';
const now = new Date(2026, 9, 3, 12);
beforeEach(() => localStorage.clear());

describe('GAP-C07 native budget payload', () => {
  it('is null without a project or without a cap', () => {
    expect(nativeBudget(null)).toBeNull();
    expect(nativeBudget(P)).toBeNull();
  });

  it('carries the cap, month-to-date spend and month', () => {
    writeBudget(P, { monthlyLimitUsd: 5, warnAtPercent: 80 });
    recordCost(P, SERP, 1.25, now);
    expect(nativeBudget(P, now)).toEqual({ limitUsd: 5, spentUsd: 1.25, month: monthKey(now) });
  });
});

describe('GAP-C07 unseen endpoint estimate', () => {
  it('blocks the first call when the conservative estimate exceeds what is left', () => {
    writeBudget(P, { monthlyLimitUsd: UNSEEN_ENDPOINT_ESTIMATE_USD / 2, warnAtPercent: 80 });
    expect(() => reserveBudget(P, SERP, now)).toThrow(DataForSeoBudgetError);
  });

  it('allows the first call when the cap covers the estimate, then uses the observed price', () => {
    writeBudget(P, { monthlyLimitUsd: 1, warnAtPercent: 80 });
    reserveBudget(P, SERP, now)();
    recordCost(P, SERP, 0.9, now);
    expect(() => reserveBudget(P, SERP, now)).toThrow(DataForSeoBudgetError);
  });
});
