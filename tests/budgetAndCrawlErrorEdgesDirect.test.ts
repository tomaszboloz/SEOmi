import { afterEach, describe, expect, it } from 'vitest';
import { budgetStatus, monthKey, readBudget, readSpend } from '@/services/dataforseo/dataforseoBudget';
import { crawlErrorKinds } from '@/services/crawlErrors';

const project = 'budget-edge-direct';
const budgetKey = `seomi_project_${project}_dataforseo_budget_v1`;
const spendKey = `seomi_project_${project}_dataforseo_spend_v1`;

afterEach(() => {
  localStorage.removeItem(budgetKey);
  localStorage.removeItem(spendKey);
});

describe('budget stored shape and crawl error sorting contracts', () => {
  it.each(['null', '[]', '7', '"text"'])('rejects JSON non-object budget values: %s', raw => {
    localStorage.setItem(budgetKey, raw);
    expect(readBudget(project)).toEqual({ monthlyLimitUsd: null, warnAtPercent: 80 });
  });

  it('defaults invalid current-month totals/calls without erasing valid endpoint costs', () => {
    const now = new Date(2026, 9, 5);
    localStorage.setItem(spendKey, JSON.stringify({
      month: monthKey(now), totalUsd: -1, calls: 0.5,
      lastCostByEndpoint: { '/valid': 0.01, '/invalid': -1 },
    }));
    const spend = readSpend(project, now);
    expect(spend).toEqual({
      month: '2026-10', totalUsd: 0, calls: 0,
      lastCostByEndpoint: { '/valid': 0.01 }, lastCall: null,
    });
    expect(budgetStatus({ ...spend, totalUsd: 0.001 }, {
      monthlyLimitUsd: 0, warnAtPercent: 80,
    })).toEqual({ level: 'exceeded', percent: 100, remainingUsd: 0 });
  });

  it('places known error kinds before alphabetically ordered unknown kinds', () => {
    const records = [
      { request_error_kind: 'Zeta' }, { request_error_kind: 'dns' },
      { request_error_kind: 'Alpha' }, { http_status: 503 },
      { request_error_kind: 'network' }, { request_error_kind: 'alpha' },
    ];
    expect(crawlErrorKinds(records)).toEqual(['http', 'dns', 'network', 'alpha', 'zeta']);
    expect(records[0].request_error_kind).toBe('Zeta');
  });
});
