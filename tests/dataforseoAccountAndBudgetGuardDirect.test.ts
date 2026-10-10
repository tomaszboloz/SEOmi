import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as storage from '@/services/storage';
import {
  parseUserData,
  readAccount,
  writeAccount,
  deductFromAccount,
} from '@/services/dataforseo/dataforseoAccount';
import {
  reserveBudget,
  DataForSeoBudgetError,
} from '@/services/dataforseo/dataforseoBudgetGuard';
import { getDomainOverview } from '@/services/dataforseo/dataforseoDomain';
import type { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';

describe('dataforseo account, budget guard and domain direct contracts', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses user data with missing balance and fallback limit shapes', () => {
    expect(parseUserData({})).toBeNull();
    const result = parseUserData({
      tasks: [{
        result: [{
          login: 'user@test',
          money: { balance: 10.5, limits: { day: 5 } },
        }],
      }],
    });
    expect(result).toMatchObject({ login: 'user@test', balanceUsd: 10.5, dailyLimitUsd: 5 });
  });

  it('handles readAccount corrupt storage and writeAccount exceptions', () => {
    vi.spyOn(storage, 'readStorage').mockImplementation(() => { throw new Error('storage read fail'); });
    expect(readAccount('p1')).toBeNull();

    vi.spyOn(storage, 'writeStorage').mockImplementation(() => { throw new Error('storage write fail'); });
    expect(() => writeAccount('p1', {
      login: 'u', balanceUsd: 10, estimatedBalanceUsd: 10, dailyLimitUsd: null, fetchedAt: 'now',
    })).not.toThrow();

    // deductFromAccount guards
    deductFromAccount('p1', 0);
    deductFromAccount('p1', -5);
  });

  it('exercises budget guard multi-release bounds and no-limit balance check', () => {
    // null projectId or account endpoint
    const release = reserveBudget(null, '/v3/appendix/user_data');
    expect(() => release()).not.toThrow();

    // With balance check
    writeAccount('p_budget', {
      login: 'u', balanceUsd: 0.001, estimatedBalanceUsd: 0.001, dailyLimitUsd: null, fetchedAt: 'now',
    });
    // First reservation leaves remaining budget
    const r1 = reserveBudget('p_budget', '/v3/custom_endpoint');
    const r2 = reserveBudget('p_budget', '/v3/custom_endpoint');
    r1();
    r1(); // idempotent
    r2();

    // Exceed balance
    writeAccount('p_budget', {
      login: 'u', balanceUsd: 0, estimatedBalanceUsd: 0, dailyLimitUsd: null, fetchedAt: 'now',
    });
    expect(() => reserveBudget('p_budget', '/v3/custom_endpoint')).toThrow(DataForSeoBudgetError);
  });

  it('returns null when getDomainOverview receives empty items', async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue([]),
    } as unknown as DataForSEOCore;

    const overview = await getDomainOverview(mockClient, 'example.com', 2840, 'en');
    expect(overview).toBeNull();
  });
});
